import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, expectSqlError, ids, pool, seedTwoOrgs } from './helpers';

beforeAll(async () => {
  await seedTwoOrgs();
  await pool.query("delete from storage.objects where bucket_id = 'documents'");
  await pool.query("insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${ids.orgA}/doc-1/dovoljenje.pdf`]);
});
afterAll(() => pool.end());

const insertObject = "insert into storage.objects (bucket_id, name) values ('documents', $1)";
const countObjects = "select count(*)::int n from storage.objects where bucket_id = 'documents'";

describe('documents bucket', () => {
  it('exists and is private with limits', async () => {
    const { rows } = await pool.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'documents'");
    expect(rows[0]).toMatchObject({ public: false, file_size_limit: '20971520' });
    expect(rows[0].allowed_mime_types).toEqual(expect.arrayContaining(['application/pdf', 'image/jpeg', 'image/png']));
  });
  it('alice can upload into her organization folder', async () => {
    await asUser(ids.alice, async (c) => {
      await c.query(insertObject, [`${ids.orgA}/doc-2/odlocba.pdf`]);
    });
  });
  it('alice cannot upload into another organization folder', async () => {
    await asUser(ids.alice, (c) => expectSqlError(c, insertObject, [`${ids.orgB}/doc-3/x.pdf`], '42501'));
  });
  it('a path that does not start with an organization id is rejected', async () => {
    await asUser(ids.alice, (c) => expectSqlError(c, insertObject, ['ni-uuid/x.pdf'], '42501'));
    await asUser(ids.alice, (c) => expectSqlError(c, insertObject, ['x.pdf'], '42501'));
  });
  it('bob cannot see organization A documents, alice can', async () => {
    await asUser(ids.bob, async (c) => expect((await c.query(countObjects)).rows[0].n).toBe(0));
    await asUser(ids.alice, async (c) => expect((await c.query(countObjects)).rows[0].n).toBe(1));
  });
  it('bob cannot delete organization A documents', async () => {
    await asUser(ids.bob, async (c) => {
      expect((await c.query("delete from storage.objects where bucket_id = 'documents'")).rowCount).toBe(0);
    });
  });
  it('anon sees nothing', async () => {
    await asUser(null, async (c) => expect((await c.query(countObjects)).rows[0].n).toBe(0));
  });
});
