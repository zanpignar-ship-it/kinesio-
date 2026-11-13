import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, ids, pool, seedTwoOrgs } from './helpers';

beforeAll(async () => {
  await seedTwoOrgs();
  const ship = (await pool.query<{ id: string }>('select id from shipments where organization_id = $1', [ids.orgA])).rows[0]!.id;
  await pool.query(
    `insert into buyer_shares (organization_id, token_hash, expires_at, shipment_ids) values
       ($1, extensions.digest('valid-token', 'sha256'), now() + interval '1 day', array[$2::uuid]),
       ($1, extensions.digest('expired-token', 'sha256'), now() - interval '1 day', array[$2::uuid])`,
    [ids.orgA, ship],
  );
  await pool.query(
    `insert into buyer_shares (organization_id, token_hash, expires_at, shipment_ids, revoked_at)
     values ($1, extensions.digest('revoked-token', 'sha256'), now() + interval '1 day', array[$2::uuid], now())`,
    [ids.orgA, ship],
  );
});
afterAll(() => pool.end());

type Pkg = { organization: { name: string }; shipments: { internal_ref: string; plots: { label: string; geometry: { type: string } }[]; items: unknown[]; documents: { title: string }[] }[] } | null;

describe('buyer_package', () => {
  it('returns the shared shipments for a valid token, to anonymous visitors', async () => {
    await asUser(null, async (c) => {
      const { rows } = await c.query<{ p: Pkg }>("select public.buyer_package('valid-token') p");
      const p = rows[0]!.p!;
      expect(p.organization.name).toBe('Žaga A');
      expect(p.shipments).toHaveLength(1);
      expect(p.shipments[0]!.internal_ref).toBe('S-1');
      expect(p.shipments[0]!.plots[0]!.label).toBe('P1');
      expect(p.shipments[0]!.plots[0]!.geometry.type).toBe('Point');
      expect(p.shipments[0]!.items).toHaveLength(1);
      expect(p.shipments[0]!.documents[0]!.title).toBe('Dovoljenje');
    });
  });
  it('returns null for expired, revoked or unknown tokens', async () => {
    await asUser(null, async (c) => {
      for (const t of ['expired-token', 'revoked-token', 'nope', '']) {
        const { rows } = await c.query<{ p: Pkg }>('select public.buyer_package($1) p', [t]);
        expect(rows[0]!.p, t).toBeNull();
      }
    });
  });
  it('records when the package was last viewed', async () => {
    await pool.query("select public.buyer_package('valid-token')");
    const { rows } = await pool.query("select last_viewed_at from buyer_shares where token_hash = extensions.digest('valid-token', 'sha256')");
    expect(rows[0]!.last_viewed_at).not.toBeNull();
  });
  it('does not open buyer_shares to anonymous visitors', async () => {
    await asUser(null, async (c) => {
      await c.query('savepoint s');
      try {
        const { rows } = await c.query('select count(*)::int n from buyer_shares');
        expect(rows[0].n).toBe(0);
      } catch (e) {
        expect((e as { code?: string }).code).toBe('42501');
      }
    });
  });
});

describe('buyer document access', () => {
  it('grants one shared document for a valid token, nothing otherwise', async () => {
    const doc = (await pool.query<{ id: string; file_path: string }>('select id, file_path from documents where organization_id = $1', [ids.orgA])).rows[0]!;
    const docB = (await pool.query<{ id: string }>('select id from documents where organization_id = $1', [ids.orgB])).rows[0]!.id;
    await pool.query("insert into storage.objects (bucket_id, name) values ('documents', $1) on conflict do nothing", [doc.file_path]);
    await asUser(null, async (c) => {
      expect((await c.query("select count(*)::int n from storage.objects where bucket_id = 'documents'")).rows[0].n).toBe(0);
      const { rows } = await c.query('select public.buyer_document_access($1, $2) a', ['valid-token', doc.id]);
      expect(rows[0].a.path).toBe(doc.file_path);
      expect((await c.query("select count(*)::int n from storage.objects where bucket_id = 'documents' and name = $1", [doc.file_path])).rows[0].n).toBe(1);
      expect((await c.query('select public.buyer_document_access($1, $2) a', ['valid-token', docB])).rows[0].a).toBeNull();
      expect((await c.query('select public.buyer_document_access($1, $2) a', ['expired-token', doc.id])).rows[0].a).toBeNull();
      // repeated requests keep one grant per file
      await c.query('select public.buyer_document_access($1, $2) a', ['valid-token', doc.id]);
      await c.query('reset role');
      expect((await c.query('select count(*)::int n from private.buyer_file_grants')).rows[0].n).toBe(1);
      // revoking the share ends the grant at once
      await c.query('update buyer_shares set revoked_at = now() where organization_id = $1 and revoked_at is null', [ids.orgA]);
      await c.query('set role anon');
      expect((await c.query("select count(*)::int n from storage.objects where bucket_id = 'documents' and name = $1", [doc.file_path])).rows[0].n).toBe(0);
    });
  });
});
