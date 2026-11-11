import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, expectSqlError, ids, pool, seedTwoOrgs } from './helpers';

beforeAll(seedTwoOrgs);
afterAll(() => pool.end());

describe('audit_log', () => {
  it('records insert, update and delete of a plot with the acting user', async () => {
    await asUser(ids.alice, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into plots (organization_id, label, country, validation_status) values ($1, 'Nova', 'SI', 'warning') returning id`,
        [ids.orgA],
      );
      const id = rows[0]!.id;
      await c.query("update plots set label = 'Nova 2' where id = $1", [id]);
      await c.query('delete from plots where id = $1', [id]);
      const log = await c.query<{ action: string; actor_id: string; old_label: string | null; new_label: string | null }>(
        `select action, actor_id, old_data->>'label' old_label, new_data->>'label' new_label
         from audit_log where table_name = 'plots' and row_id = $1 order by id`,
        [id],
      );
      expect(log.rows).toEqual([
        { action: 'INSERT', actor_id: ids.alice, old_label: null, new_label: 'Nova' },
        { action: 'UPDATE', actor_id: ids.alice, old_label: 'Nova', new_label: 'Nova 2' },
        { action: 'DELETE', actor_id: ids.alice, old_label: 'Nova 2', new_label: null },
      ]);
    });
  });
  it('cannot be changed or deleted by users', async () => {
    await asUser(ids.alice, async (c) => {
      await expectSqlError(c, "update audit_log set action = 'X' where organization_id = $1", [ids.orgA], '42501');
      await expectSqlError(c, 'delete from audit_log where organization_id = $1', [ids.orgA], '42501');
      await expectSqlError(c, "insert into audit_log (organization_id, table_name, row_id, action) values ($1, 'x', 'x', 'INSERT')", [ids.orgA], '42501');
    });
  });
  it('is visible only to members of the organization', async () => {
    await asUser(ids.bob, async (c) => {
      const n = await c.query<{ n: string }>('select count(*) n from audit_log where organization_id = $1', [ids.orgA]);
      expect(Number(n.rows[0]!.n)).toBe(0);
    });
    await asUser(ids.alice, async (c) => {
      const n = await c.query<{ n: string }>('select count(*) n from audit_log where organization_id = $1', [ids.orgA]);
      expect(Number(n.rows[0]!.n)).toBeGreaterThan(0);
    });
  });
});
