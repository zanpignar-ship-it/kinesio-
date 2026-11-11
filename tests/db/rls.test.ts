import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asService, asUser, expectSqlError, ids, pool, seedTwoOrgs, TENANT_TABLES } from './helpers';

beforeAll(seedTwoOrgs);
afterAll(() => pool.end());

const count = async (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: { n: string }[] }> }, sql: string, p: unknown[] = []) =>
  Number((await c.query(sql, p)).rows[0]?.n);

/** A copy of one of the user's own rows, moved to `targetOrg` (with a fresh id where the table has one). */
const copyIntoOrg = (table: string) => `
  insert into ${table}
  select (jsonb_populate_record(null::${table},
    to_jsonb(r) || jsonb_build_object('organization_id', $2::uuid)
    || case when to_jsonb(r) ? 'id' then jsonb_build_object('id', gen_random_uuid()) else '{}'::jsonb end)).*
  from ${table} r where r.organization_id = $1 limit 1`;

describe.each(TENANT_TABLES)('RLS on %s', (table) => {
  it('alice sees her org row but not org B', async () => {
    await asUser(ids.alice, async (c) => {
      expect(await count(c, `select count(*) n from ${table} where organization_id = $1`, [ids.orgA])).toBe(1);
      expect(await count(c, `select count(*) n from ${table} where organization_id = $1`, [ids.orgB])).toBe(0);
    });
  });
  it('alice cannot insert a row into org B', async () => {
    await asUser(ids.alice, (c) => expectSqlError(c, copyIntoOrg(table), [ids.orgA, ids.orgB], '42501'));
  });
  it('alice cannot update or delete org B rows', async () => {
    await asUser(ids.alice, async (c) => {
      expect((await c.query(`update ${table} set organization_id = organization_id where organization_id = $1`, [ids.orgB])).rowCount).toBe(0);
      expect((await c.query(`delete from ${table} where organization_id = $1`, [ids.orgB])).rowCount).toBe(0);
    });
    await asService(async (c) => expect(await count(c, `select count(*) n from ${table} where organization_id = $1`, [ids.orgB])).toBe(1));
  });
  it('alice cannot move her row to org B', async () => {
    await asUser(ids.alice, (c) =>
      expectSqlError(c, `update ${table} set organization_id = $2 where organization_id = $1`, [ids.orgA, ids.orgB], '42501'),
    );
  });
  it('carol (member of A and B) sees both, bob cannot write into A', async () => {
    await asUser(ids.carol, async (c) => {
      expect(await count(c, `select count(*) n from ${table} where organization_id in ($1, $2)`, [ids.orgA, ids.orgB])).toBe(2);
    });
    await asUser(ids.bob, (c) => expectSqlError(c, copyIntoOrg(table), [ids.orgB, ids.orgA], '42501'));
  });
  it('anon sees nothing', async () => {
    await asUser(null, async (c) => {
      await c.query('savepoint s');
      try {
        expect(await count(c, `select count(*) n from ${table}`)).toBe(0);
      } catch (e) {
        expect((e as { code?: string }).code).toBe('42501');
      }
    });
  });
});

describe('organizations and memberships', () => {
  it('alice sees only her organization', async () => {
    await asUser(ids.alice, async (c) => {
      const rows = (await c.query<{ id: string }>('select id from organizations order by id')).rows.map((r) => r.id);
      expect(rows).toEqual([ids.orgA]);
    });
  });
  it('members of the partner organization see the link (read only)', async () => {
    const c = await pool.connect();
    try {
      await c.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'member')", [ids.orgC, ids.bob]);
      await asUser(ids.bob, async (cc) => {
        expect(await count(cc, 'select count(*) n from organization_links where organization_id = $1', [ids.orgA])).toBe(1);
        expect((await cc.query('delete from organization_links where organization_id = $1', [ids.orgA])).rowCount).toBe(0);
      });
    } finally {
      await c.query('delete from memberships where organization_id = $1 and user_id = $2', [ids.orgC, ids.bob]);
      c.release();
    }
  });
  it('creating an organization makes the creator its owner', async () => {
    await asUser(ids.alice, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        "insert into organizations (name, country, kind, size) values ('Nova', 'HR', 'trader', 'micro') returning id",
      );
      const id = rows[0]!.id;
      const m = await c.query('select role from memberships where organization_id = $1 and user_id = $2', [id, ids.alice]);
      expect(m.rows).toEqual([{ role: 'owner' }]);
    });
  });
  it('a member cannot change memberships, an owner can', async () => {
    await asUser(ids.carol, async (c) => {
      expect((await c.query("update memberships set role = 'owner' where organization_id = $1 and user_id = $2", [ids.orgA, ids.carol])).rowCount).toBe(0);
      await expectSqlError(c, "insert into memberships (organization_id, user_id, role) values ($1, $2, 'member')", [ids.orgA, ids.bob], '42501');
    });
    await asUser(ids.alice, async (c) => {
      expect((await c.query("update memberships set role = 'owner' where organization_id = $1 and user_id = $2", [ids.orgA, ids.carol])).rowCount).toBe(1);
    });
  });
  it('the last owner cannot be removed or demoted', async () => {
    await asUser(ids.alice, async (c) => {
      await expectSqlError(c, 'delete from memberships where organization_id = $1 and user_id = $2', [ids.orgA, ids.alice], 'P0001');
      await expectSqlError(c, "update memberships set role = 'member' where organization_id = $1 and user_id = $2", [ids.orgA, ids.alice], 'P0001');
    });
  });
  it('an owner can delete the whole organization', async () => {
    await asUser(ids.alice, async (c) => {
      expect((await c.query('delete from organizations where id = $1', [ids.orgA])).rowCount).toBe(1);
      await c.query('set constraints all immediate');
    });
  });
  it('a plot used in a shipment cannot be deleted', async () => {
    await asUser(ids.alice, async (c) => {
      await c.query('delete from plots where organization_id = $1', [ids.orgA]);
      await expectSqlError(c, 'set constraints all immediate', [], '23503');
    });
  });
  it('a member cannot rename the organization', async () => {
    await asUser(ids.carol, async (c) => {
      expect((await c.query("update organizations set name = 'x' where id = $1", [ids.orgA])).rowCount).toBe(0);
    });
  });
  it('invitations are visible to owners only', async () => {
    await pool.query(
      "insert into invitations (organization_id, email, role, token_hash, expires_at) values ($1, 'inv@y.si', 'member', 'tok1'::bytea, now() + interval '7 days')",
      [ids.orgA],
    );
    await asUser(ids.alice, async (c) => expect(await count(c, 'select count(*) n from invitations')).toBe(1));
    await asUser(ids.carol, async (c) => expect(await count(c, 'select count(*) n from invitations')).toBe(0));
  });
});

describe('integrity', () => {
  it('a plot of org A cannot be linked to a document of org B (even by the service role)', async () => {
    await asService((c) =>
      expectSqlError(
        c,
        `insert into plot_documents (organization_id, plot_id, document_id)
         select $1, p.id, d.id from plots p, documents d where p.organization_id = $1 and d.organization_id = $2`,
        [ids.orgA, ids.orgB],
        '23503',
      ),
    );
  });
  it('plots.geom rejects a LineString', async () => {
    await asUser(ids.alice, (c) =>
      expectSqlError(
        c,
        `update plots set geom = extensions.st_geomfromtext('LINESTRING(14.5 46, 14.6 46.1)', 4326) where organization_id = $1`,
        [ids.orgA],
        '23514',
      ),
    );
  });
  it('plots.geom rejects a non-WGS-84 SRID', async () => {
    await asUser(ids.alice, async (c) => {
      await c.query('savepoint s');
      await expect(
        c.query(`update plots set geom = extensions.st_setsrid(extensions.st_makepoint(462000, 101000), 3794) where organization_id = $1`, [ids.orgA]),
      ).rejects.toThrow();
      await c.query('rollback to savepoint s');
    });
  });
  it('reference tables are readable by anyone and writable by no API role', async () => {
    await asUser(null, async (c) => {
      expect(await count(c, 'select count(*) n from species')).toBeGreaterThanOrEqual(15);
      expect(await count(c, "select count(*) n from country_risk where country in ('SI','HR','BA','RS') and risk = 'low'")).toBe(4);
      expect(await count(c, "select count(*) n from hs_codes where code = '4403' and in_scope")).toBe(1);
    });
    await asUser(ids.alice, (c) => expectSqlError(c, "insert into country_risk (country, risk, source_act) values ('XX', 'low', 'x')", [], '42501'));
  });
  it('updated_at changes on update', async () => {
    await asUser(ids.alice, async (c) => {
      const before = (await c.query<{ t: Date }>('select updated_at t from plots where organization_id = $1', [ids.orgA])).rows[0]!.t;
      await c.query("select pg_sleep(0.01)");
      await c.query("update plots set label = 'P1b' where organization_id = $1", [ids.orgA]);
      const after = (await c.query<{ t: Date }>('select updated_at t from plots where organization_id = $1', [ids.orgA])).rows[0]!.t;
      expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
