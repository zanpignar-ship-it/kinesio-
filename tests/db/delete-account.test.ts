import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { asUser, expectSqlError, ids, pool, seedTwoOrgs } from './helpers';

beforeEach(async () => {
  await seedTwoOrgs();
});
afterAll(() => pool.end());

type Res = { blocked: string[]; solo: string[] };

describe('delete_my_account', () => {
  it('dry run reports blocking organizations and changes nothing', async () => {
    await asUser(ids.alice, async (c) => {
      const { rows } = await c.query<{ r: Res }>('select public.delete_my_account(true) r');
      expect(rows[0]!.r).toEqual({ blocked: ['Žaga A'], solo: [] });
    });
    expect((await pool.query("select count(*)::int n from auth.users")).rows[0].n).toBe(3);
  });

  it('refuses to delete the last owner of an organization with other members', async () => {
    await asUser(ids.alice, async (c) => {
      await expectSqlError(c, 'select public.delete_my_account(false)', [], 'P0001');
    });
  });

  it('a member is removed; the organization and its data stay', async () => {
    await asUser(ids.carol, async (c) => {
      await c.query('select public.delete_my_account(false)');
      await c.query('reset role');
      expect((await c.query('select 1 from auth.users where id = $1', [ids.carol])).rowCount).toBe(0);
      expect((await c.query('select count(*)::int n from plots')).rows[0].n).toBe(2);
      expect((await c.query('select count(*)::int n from memberships where user_id = $1', [ids.carol])).rows[0].n).toBe(0);
    });
  });

  it('the only member deletes the account together with the organization and its audit log', async () => {
    await pool.query('delete from memberships where user_id = $1', [ids.carol]);
    await asUser(ids.alice, async (c) => {
      const { rows } = await c.query<{ r: Res }>('select public.delete_my_account(false) r');
      expect(rows[0]!.r.solo).toEqual([ids.orgA]);
      await c.query('reset role');
      expect((await c.query('select count(*)::int n from organizations where id = $1', [ids.orgA])).rows[0].n).toBe(0);
      expect((await c.query('select count(*)::int n from plots where organization_id = $1', [ids.orgA])).rows[0].n).toBe(0);
      expect((await c.query('select count(*)::int n from audit_log where organization_id = $1', [ids.orgA])).rows[0].n).toBe(0);
      expect((await c.query('select count(*)::int n from organizations where id = $1', [ids.orgB])).rows[0].n).toBe(1);
      expect((await c.query('select 1 from auth.users where id = $1', [ids.alice])).rowCount).toBe(0);
    });
  });

  it('anonymous visitors cannot call it', async () => {
    await asUser(null, async (c) => {
      await expectSqlError(c, 'select public.delete_my_account(true)', [], '42501');
    });
  });
});
