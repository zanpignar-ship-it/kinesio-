import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { asUser, expectSqlError, ids, pool, seedTwoOrgs } from './helpers';

const TOKEN = 'portal-token-0123456789abcdef0123456789abcdef';
let supplierA = '';
let linkId = '';
let otherSupplierPlot = '';

beforeEach(async () => {
  await seedTwoOrgs();
  supplierA = (await pool.query<{ id: string }>('select id from suppliers where organization_id = $1', [ids.orgA])).rows[0]!.id;
  linkId = (
    await pool.query<{ id: string }>(
      "insert into supplier_links (organization_id, supplier_id, token_hash, expires_at) values ($1, $2, extensions.digest($3, 'sha256'), now() + interval '30 days') returning id",
      [ids.orgA, supplierA, TOKEN],
    )
  ).rows[0]!.id;
  // a plot of org A without this supplier (must stay invisible to the portal)
  otherSupplierPlot = (
    await pool.query<{ id: string }>("insert into plots (organization_id, label, country, validation_status, postal_address) values ($1, 'Tuja', 'SI', 'warning', 'x') returning id", [ids.orgA])
  ).rows[0]!.id;
});
afterAll(() => pool.end());

const point = JSON.stringify({ type: 'Point', coordinates: [14.512345, 46.051234] });

describe('supplier portal', () => {
  it('shows the supplier only its own plots', async () => {
    await asUser(null, async (c) => {
      const { rows } = await c.query('select public.supplier_portal_info($1) i', [TOKEN]);
      const info = rows[0].i;
      expect(info.organization).toBe('Žaga A');
      expect(info.plots.map((p: { label: string }) => p.label)).toEqual(['P1']);
      expect(JSON.stringify(info)).not.toContain(otherSupplierPlot);
      expect((await c.query('select public.supplier_portal_info($1) i', ['wrong-token-0123456789abcdef0123456789'])).rows[0].i).toBeNull();
    });
  });

  it('adds a plot for review and a document linked only to the supplier\'s plots', async () => {
    await asUser(null, async (c) => {
      const { rows } = await c.query('select public.supplier_portal_add_plot($1, $2, $3, $4, $5, $6) id', [TOKEN, 'Novakov gozd', point, 1.5, '2026-01-10', '2026-02-01']);
      const plotId = rows[0].id as string;
      const doc = await c.query('select public.supplier_portal_add_document($1, $2, $3, $4, $5, $6, $7, $8, $9) id', [
        TOKEN, 'Odločba o poseku', 'felling_permit', null, '2027-01-01', `${ids.orgA}/portal-${linkId}/x/odlocba.pdf`, 'application/pdf', 1000, [plotId, otherSupplierPlot],
      ]);
      expect(doc.rows[0].id).toBeTruthy();
      await expectSqlError(c, 'select public.supplier_portal_add_document($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
        TOKEN, 'X', 'other', null, null, `${ids.orgB}/elsewhere/x.pdf`, 'application/pdf', 10, [],
      ], 'P0001');
      await expectSqlError(c, 'select public.supplier_portal_add_plot($1, $2, $3, $4, $5, $6)', [TOKEN, 'Črta', JSON.stringify({ type: 'LineString', coordinates: [[14, 46], [15, 46]] }), null, null, null], 'P0001');
      await c.query('reset role');
      const plot = (await c.query("select supplier_id, validation_status, validation_issues, area_ha, area_source, country from plots where label = 'Novakov gozd'")).rows[0];
      expect(plot).toMatchObject({ supplier_id: supplierA, validation_status: 'warning', area_source: 'declared', country: 'SI' });
      expect(plot.validation_issues[0].code).toBe('SUPPLIER_SUBMITTED');
      const links = (await c.query('select plot_id from plot_documents pd join documents d on d.id = pd.document_id where d.title = $1', ['Odločba o poseku'])).rows;
      expect(links).toEqual([{ plot_id: plotId }]);
    });
  });

  it('revoked or expired links stop working; revoking is final', async () => {
    await pool.query('update supplier_links set revoked_at = now() where id = $1', [linkId]);
    await asUser(null, async (c) => {
      expect((await c.query('select public.supplier_portal_info($1) i', [TOKEN])).rows[0].i).toBeNull();
      await expectSqlError(c, 'select public.supplier_portal_add_plot($1, $2, $3, $4, $5, $6)', [TOKEN, 'X', point, 1, null, null], 'P0001');
    });
    await asUser(ids.alice, async (c) => {
      await expectSqlError(c, 'update supplier_links set revoked_at = null where id = $1', [linkId], 'P0001');
    });
  });

  it('uploads are allowed only into the folder of a valid link', async () => {
    const ok = `${ids.orgA}/portal-${linkId}/u1/a.pdf`;
    await asUser(null, async (c) => {
      await c.query("insert into storage.objects (bucket_id, name) values ('documents', $1)", [ok]);
      await expectSqlError(c, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${ids.orgB}/portal-${linkId}/u1/a.pdf`], '42501');
      await expectSqlError(c, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${ids.orgA}/doc-1/a.pdf`], '42501');
    });
  });

  it('links are visible to members of the organization only', async () => {
    await asUser(ids.carol, async (c) => expect((await c.query('select count(*)::int n from supplier_links')).rows[0].n).toBe(1));
    await asUser(ids.bob, async (c) => expect((await c.query('select count(*)::int n from supplier_links')).rows[0].n).toBe(0));
  });
});

describe('portal hardening', () => {
  it('a document cannot point at another organization\'s file', async () => {
    await asUser(ids.bob, async (c) => {
      await expectSqlError(c, "insert into documents (organization_id, type, title, file_path, mime, size_bytes) values ($1, 'other', 'X', $2, 'application/pdf', 1)", [ids.orgB, `${ids.orgA}/doc/x.pdf`], '23514');
    });
  });
  it('links cannot be retargeted or made to last longer than a year', async () => {
    await asUser(ids.alice, async (c) => {
      await expectSqlError(c, "update supplier_links set token_hash = extensions.digest('other', 'sha256') where id = $1", [linkId], 'P0001');
      await expectSqlError(c, "insert into supplier_links (organization_id, supplier_id, token_hash, expires_at) values ($1, $2, extensions.digest('t2', 'sha256'), now() + interval '5 years')", [ids.orgA, supplierA], '23514');
    });
  });
});
