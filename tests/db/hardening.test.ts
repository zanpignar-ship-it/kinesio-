import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, expectSqlError, ids, pool, seedTwoOrgs } from './helpers';

beforeAll(seedTwoOrgs);
afterAll(() => pool.end());

const n = async (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: { n: string }[] }> }, sql: string, p: unknown[] = []) =>
  Number((await c.query(sql, p)).rows[0]?.n);

describe('1: organization ids cannot be chosen by users', () => {
  it('re-creating a deleted organization id does not expose its audit log', async () => {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query('delete from organizations where id = $1', [ids.orgB]);
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [ids.alice]);
      const { rows } = await c.query<{ id: string }>(
        "insert into organizations (id, name, country, kind, size) values ($1, 'Ugrabljena', 'SI', 'trader', 'micro') returning id",
        [ids.orgB],
      );
      expect(rows[0]!.id).not.toBe(ids.orgB);
      expect(await n(c, 'select count(*) n from audit_log where organization_id = $1', [ids.orgB])).toBe(0);
    } finally {
      await c.query('rollback');
      c.release();
    }
  });
});

describe('2: organization_id is immutable', () => {
  it('a member of A and B cannot move a document from A to B', async () => {
    await asUser(ids.carol, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        "insert into documents (organization_id, type, title, file_path, mime, size_bytes) values ($1, 'other', 'X', 'x', 'application/pdf', 1) returning id",
        [ids.orgA],
      );
      await expectSqlError(c, 'update documents set organization_id = $2 where id = $1', [rows[0]!.id, ids.orgB], 'P0001');
    });
  });
  it('an owner cannot move a membership to another organization', async () => {
    await asUser(ids.alice, (c) =>
      expectSqlError(c, 'update memberships set organization_id = $2 where organization_id = $1 and user_id = $3', [ids.orgA, ids.orgB, ids.carol], 'P0001'),
    );
  });
});

describe('3: organization links', () => {
  it('a plain member cannot create a link', async () => {
    await asUser(ids.carol, (c) =>
      expectSqlError(c, "insert into organization_links (organization_id, partner_organization_id) values ($1, $2)", [ids.orgA, ids.orgB], '42501'),
    );
  });
  it('a new link is always pending', async () => {
    await asUser(ids.alice, async (c) => {
      const { rows } = await c.query<{ status: string }>(
        "insert into organization_links (organization_id, partner_organization_id, status) values ($1, $2, 'active') returning status",
        [ids.orgA, ids.orgB],
      );
      expect(rows[0]!.status).toBe('pending');
    });
  });
  it('only the partner owner can activate; either side can revoke', async () => {
    const link = (await pool.query<{ id: string }>(
      "insert into organization_links (organization_id, partner_organization_id) values ($1, $2) returning id",
      [ids.orgB, ids.orgA],
    )).rows[0]!.id;
    try {
      await asUser(ids.bob, (c) => expectSqlError(c, "update organization_links set status = 'active' where id = $1", [link], 'P0001'));
      await asUser(ids.alice, async (c) => {
        expect((await c.query("update organization_links set status = 'active' where id = $1", [link])).rowCount).toBe(1);
      });
      await asUser(ids.alice, async (c) => {
        expect((await c.query("update organization_links set status = 'revoked' where id = $1", [link])).rowCount).toBe(1);
      });
      await asUser(ids.bob, async (c) => {
        expect((await c.query("update organization_links set status = 'revoked' where id = $1", [link])).rowCount).toBe(1);
      });
    } finally {
      await pool.query('delete from organization_links where id = $1', [link]);
    }
  });
});

describe('4: buyer share shipments belong to the organization', () => {
  it('carol cannot share a B shipment from organization A', async () => {
    await asUser(ids.carol, (c) =>
      expectSqlError(
        c,
        `insert into buyer_shares (organization_id, token_hash, expires_at, shipment_ids)
         select $1, 'tok-x'::bytea, now() + interval '1 day', array[id] from shipments where organization_id = $2`,
        [ids.orgA, ids.orgB],
        '23503',
      ),
    );
  });
});

describe('5: created_by cannot be spoofed', () => {
  it('insert records the real user, update keeps the original', async () => {
    await asUser(ids.alice, async (c) => {
      const { rows } = await c.query<{ id: string; created_by: string }>(
        "insert into suppliers (organization_id, name, country, kind, created_by) values ($1, 'S', 'SI', 'company', $2) returning id, created_by",
        [ids.orgA, ids.bob],
      );
      expect(rows[0]!.created_by).toBe(ids.alice);
      const u = await c.query<{ created_by: string }>('update suppliers set created_by = $2 where id = $1 returning created_by', [rows[0]!.id, ids.bob]);
      expect(u.rows[0]!.created_by).toBe(ids.alice);
    });
  });
  it('a creator removed from the organization no longer sees it', async () => {
    await asUser(ids.alice, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        "insert into organizations (name, country, kind, size) values ('Nova', 'SI', 'trader', 'micro') returning id",
      );
      const org = rows[0]!.id;
      await c.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'owner')", [org, ids.bob]);
      await c.query('delete from memberships where organization_id = $1 and user_id = $2', [org, ids.alice]);
      expect(await n(c, 'select count(*) n from organizations where id = $1', [org])).toBe(0);
    });
  });
});

describe('6: deleting a user account', () => {
  it('works for the last owner and promotes the oldest remaining member', async () => {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query('delete from auth.users where id = $1', [ids.alice]);
      const { rows } = await c.query<{ role: string }>('select role from memberships where organization_id = $1 and user_id = $2', [ids.orgA, ids.carol]);
      expect(rows).toEqual([{ role: 'owner' }]);
    } finally {
      await c.query('rollback');
      c.release();
    }
  });
});

describe('7: invitation secrets stay out of the audit log', () => {
  it('audit rows for invitations have no token_hash or email', async () => {
    await asUser(ids.alice, async (c) => {
      await c.query(
        "insert into invitations (organization_id, email, role, token_hash, expires_at) values ($1, 'secret@x.si', 'member', 'tok-7'::bytea, now() + interval '1 day')",
        [ids.orgA],
      );
      const { rows } = await c.query<{ d: Record<string, unknown> }>(
        "select new_data d from audit_log where table_name = 'invitations' order by id desc limit 1",
      );
      expect(rows[0]!.d).not.toHaveProperty('token_hash');
      expect(rows[0]!.d).not.toHaveProperty('email');
      expect(rows[0]!.d).toHaveProperty('role', 'member');
    });
  });
});
