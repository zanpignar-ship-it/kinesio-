import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, ids, pool, seedTwoOrgs } from './helpers';

beforeAll(seedTwoOrgs);
afterAll(() => pool.end());

const sq = (lon: number, lat: number) => ({ type: 'Polygon', coordinates: [[[lon, lat], [lon + 0.001, lat], [lon + 0.001, lat + 0.001], [lon, lat + 0.001], [lon, lat]]] });

describe('plots_near', () => {
  it('finds the existing plots near each imported geometry, without a blind limit', async () => {
    await asUser(ids.alice, async (c) => {
      // 600 plots in a 30 x 20 grid, 0.01° apart.
      await c.query(
        `insert into plots (organization_id, label, country, geom, validation_status)
         select $1, 'G' || i, 'SI',
           extensions.st_setsrid(extensions.st_makeenvelope(14.0 + (i % 30) * 0.01, 46.0 + (i / 30) * 0.01, 14.001 + (i % 30) * 0.01, 46.001 + (i / 30) * 0.01), 4326),
           'valid'
         from generate_series(0, 599) i`,
        [ids.orgA],
      );
      // An import spanning the whole grid, but only touching the first and the last plot.
      const geoms = [sq(14.0, 46.0), sq(14.29, 46.19)];
      const { rows } = await c.query<{ label: string }>(
        `select p.label from public.plots_near($1, $2::jsonb) n join plots p on p.id = n.id order by p.label`,
        [ids.orgA, JSON.stringify(geoms)],
      );
      expect(rows.map((r) => r.label)).toEqual(['G0', 'G599']);
    });
  });
  it('respects RLS', async () => {
    await asUser(ids.bob, async (c) => {
      const { rowCount } = await c.query('select * from public.plots_near($1, $2::jsonb)', [ids.orgA, JSON.stringify([sq(14.505, 46.049)])]);
      expect(rowCount).toBe(0);
    });
  });
});
