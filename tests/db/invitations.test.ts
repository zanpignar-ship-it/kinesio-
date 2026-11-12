import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { asUser, expectSqlError, ids, pool, seedTwoOrgs } from './helpers';

beforeEach(async () => {
  await seedTwoOrgs();
  await pool.query(
    `insert into invitations (organization_id, email, role, token_hash, expires_at) values
       ($1, 'Bob@B.test', 'member', extensions.digest('invite-bob', 'sha256'), now() + interval '7 days'),
       ($1, 'bob@b.test', 'member', extensions.digest('invite-old', 'sha256'), now() - interval '1 day')`,
    [ids.orgA],
  );
});
afterAll(() => pool.end());

describe('organization_members', () => {
  it('lists members with e-mails for members of the organization only', async () => {
    await asUser(ids.carol, async (c) => {
      const { rows } = await c.query('select email, role from public.organization_members($1)', [ids.orgA]);
      expect(rows).toEqual([{ email: 'alice@a.test', role: 'owner' }, { email: 'carol@ab.test', role: 'member' }]);
    });
    await asUser(ids.bob, async (c) => {
      expect((await c.query('select * from public.organization_members($1)', [ids.orgA])).rowCount).toBe(0);
    });
  });
});

describe('invitations', () => {
  it('shows what the link leads to', async () => {
    await asUser(ids.bob, async (c) => {
      const { rows } = await c.query('select public.invitation_info($1) i', ['invite-bob']);
      expect(rows[0].i).toMatchObject({ organization: 'Žaga A', role: 'member', email_matches: true, already_member: false });
      expect((await c.query('select public.invitation_info($1) i', ['invite-old'])).rows[0].i).toBeNull();
    });
  });

  it('the invited user joins once; the link cannot be reused', async () => {
    await asUser(ids.bob, async (c) => {
      const { rows } = await c.query('select public.accept_invitation($1) o', ['invite-bob']);
      expect(rows[0].o).toBe(ids.orgA);
      expect((await c.query('select role from memberships where organization_id = $1 and user_id = $2', [ids.orgA, ids.bob])).rows).toEqual([{ role: 'member' }]);
      await expectSqlError(c, 'select public.accept_invitation($1)', ['invite-bob'], 'P0001');
    });
  });

  it('another user cannot use the link, and expired links fail', async () => {
    await asUser(ids.carol, async (c) => {
      await expectSqlError(c, 'select public.accept_invitation($1)', ['invite-bob'], 'P0001');
    });
    await asUser(ids.bob, async (c) => {
      await expectSqlError(c, 'select public.accept_invitation($1)', ['invite-old'], 'P0001');
    });
  });

  it('anonymous visitors cannot call the functions', async () => {
    await asUser(null, async (c) => {
      await expectSqlError(c, 'select public.accept_invitation($1)', ['invite-bob'], '42501');
    });
  });
});

describe('invitation e-mail must be confirmed', () => {
  it('an unconfirmed address cannot accept', async () => {
    await pool.query('update auth.users set email_confirmed_at = null where id = $1', [ids.bob]);
    await asUser(ids.bob, async (c) => {
      expect((await c.query('select public.invitation_info($1) i', ['invite-bob'])).rows[0].i.email_matches).toBe(false);
      await expectSqlError(c, 'select public.accept_invitation($1)', ['invite-bob'], 'P0001');
    });
  });
});
