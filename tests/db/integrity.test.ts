import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { asUser, expectSqlError, ids, pool, seedTwoOrgs } from './helpers';

let ship = '';
let plot = '';
let doc = '';
let product = '';
let plotB = '';

beforeEach(async () => {
  await seedTwoOrgs();
  const one = async (sql: string, p: unknown[]) => (await pool.query<{ id: string }>(sql, p)).rows[0]!.id;
  ship = await one('select id from shipments where organization_id = $1', [ids.orgA]);
  plot = await one('select id from plots where organization_id = $1', [ids.orgA]);
  doc = await one('select id from documents where organization_id = $1', [ids.orgA]);
  product = await one('select id from products where organization_id = $1', [ids.orgA]);
  plotB = await one('select id from plots where organization_id = $1', [ids.orgB]);
});
afterAll(() => pool.end());

const count = async (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: { n: number }[] }> }, sql: string, p: unknown[] = []) =>
  (await c.query(sql, p)).rows[0]!.n;

describe('save_shipment_children', () => {
  it('replaces all children in one go and snapshots geometry in the database', async () => {
    await asUser(ids.carol, async (c) => {
      await c.query('select public.save_shipment_children($1, $2, $3, $4, $5)', [
        ship,
        JSON.stringify([{ productId: product, netMassKg: 100, volumeM3: null, pieces: null }, { productId: product, netMassKg: 5 }]),
        [plot, plotB],
        [doc],
        JSON.stringify([{ kind: 'dds', referenceNo: 'R-1', verificationNo: '' }]),
      ]);
      expect(await count(c, 'select count(*)::int n from shipment_items where shipment_id = $1', [ship])).toBe(2);
      // the plot of the other organization is ignored
      expect(await count(c, 'select count(*)::int n from shipment_plots where shipment_id = $1 and geom_snapshot is not null', [ship])).toBe(1);
      expect(await count(c, "select count(*)::int n from upstream_references where shipment_id = $1 and verification_no is null", [ship])).toBe(1);
    });
  });

  it('a failing insert rolls everything back', async () => {
    await asUser(ids.alice, async (c) => {
      // product FKs are deferred (checked at commit, which fails the whole RPC call); check them now
      await c.query('set constraints all immediate');
      await expectSqlError(
        c,
        'select public.save_shipment_children($1, $2, $3, $4, $5)',
        [ship, JSON.stringify([{ productId: '00000000-0000-4000-a000-0000000000ff', netMassKg: 1 }]), [plot], [], '[]'],
        '23503',
      );
      expect(await count(c, 'select count(*)::int n from shipment_items where shipment_id = $1', [ship])).toBe(1);
      expect(await count(c, 'select count(*)::int n from shipment_plots where shipment_id = $1', [ship])).toBe(1);
    });
  });

  it('cannot touch a shipment of another organization', async () => {
    await asUser(ids.bob, async (c) => {
      await expectSqlError(c, 'select public.save_shipment_children($1, $2, $3, $4, $5)', [ship, '[]', [], [], '[]'], 'P0002');
    });
  });
});

describe('shipment status rules', () => {
  it('submitted only from ready with a DDS reference', async () => {
    await asUser(ids.alice, async (c) => {
      await expectSqlError(c, "update shipments set status = 'submitted', dds_reference_no = 'X' where id = $1", [ship], 'P0001');
      await c.query("update shipments set status = 'ready' where id = $1", [ship]);
      await expectSqlError(c, "update shipments set status = 'submitted' where id = $1", [ship], 'P0001');
      await c.query("update shipments set status = 'submitted', dds_reference_no = '26SI1' where id = $1", [ship]);
    });
  });

  it('a submitted shipment and its children are read-only, except marking it rejected', async () => {
    await pool.query("update shipments set status = 'ready' where id = $1", [ship]);
    await pool.query("update shipments set status = 'submitted', dds_reference_no = '26SI1' where id = $1", [ship]);
    await asUser(ids.carol, async (c) => {
      await expectSqlError(c, "update shipments set internal_ref = 'Z' where id = $1", [ship], 'P0001');
      await expectSqlError(c, "update shipments set status = 'draft' where id = $1", [ship], 'P0001');
      await expectSqlError(c, 'delete from shipment_plots where shipment_id = $1', [ship], 'P0001');
      await expectSqlError(c, 'select public.save_shipment_children($1, $2, $3, $4, $5)', [ship, '[]', [], [], '[]'], 'P0001');
      await c.query("update shipments set status = 'rejected' where id = $1", [ship]);
    });
  });

  it('deleting the organization still works with submitted shipments', async () => {
    await pool.query("update shipments set status = 'ready' where id = $1", [ship]);
    await pool.query("update shipments set status = 'submitted', dds_reference_no = '26SI1' where id = $1", [ship]);
    await pool.query('delete from organizations where id = $1', [ids.orgA]);
    expect((await pool.query('select count(*)::int n from shipment_plots where organization_id = $1', [ids.orgA])).rows[0].n).toBe(0);
  });
});

describe('set_document_plots', () => {
  it('keeps existing links, adds new ones and removes the rest; ignores other organizations', async () => {
    await pool.query("insert into plots (organization_id, label, country, validation_status, postal_address) values ($1, 'P2', 'SI', 'warning', 'Naslov 1')", [ids.orgA]);
    const p2 = (await pool.query<{ id: string }>("select id from plots where label = 'P2'")).rows[0]!.id;
    await asUser(ids.alice, async (c) => {
      await c.query('select public.set_document_plots($1, $2)', [doc, [p2, plotB]]);
      const { rows } = await c.query('select plot_id from plot_documents where document_id = $1', [doc]);
      expect(rows).toEqual([{ plot_id: p2 }]);
    });
  });
});

describe('buyer links', () => {
  it('a revoked link cannot be restored or extended', async () => {
    await asUser(ids.carol, async (c) => {
      await c.query('update buyer_shares set revoked_at = now() where organization_id = $1', [ids.orgA]);
      await expectSqlError(c, 'update buyer_shares set revoked_at = null where organization_id = $1', [ids.orgA], 'P0001');
      await expectSqlError(c, "update buyer_shares set expires_at = now() + interval '5 years' where organization_id = $1", [ids.orgA], 'P0001');
    });
  });
});
