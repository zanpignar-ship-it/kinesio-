import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asUser, expectSqlError, ids, pool, seedTwoOrgs } from './helpers';

beforeAll(seedTwoOrgs);
afterAll(() => pool.end());

const square = (lon: number, lat: number, d = 0.001) => ({
  type: 'Polygon',
  crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  coordinates: [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]],
});

describe('plots_map', () => {
  it('returns a FeatureCollection with only the organization plots', async () => {
    await asUser(ids.alice, async (c) => {
      const { rows } = await c.query<{ fc: { type: string; features: { properties: { label: string; validation_status: string } }[] } }>(
        'select public.plots_map($1) fc',
        [ids.orgA],
      );
      expect(rows[0]!.fc.type).toBe('FeatureCollection');
      expect(rows[0]!.fc.features.map((f) => f.properties.label)).toEqual(['P1']);
    });
    await asUser(ids.bob, async (c) => {
      const { rows } = await c.query<{ fc: { features: unknown[] } }>('select public.plots_map($1) fc', [ids.orgA]);
      expect(rows[0]!.fc.features).toEqual([]);
    });
  });
  it('skips archived plots and rounds to 6 decimals', async () => {
    await asUser(ids.alice, async (c) => {
      await c.query(
        `insert into plots (organization_id, label, country, geom, validation_status)
         values ($1, 'Fino', 'SI', $2::jsonb::text::extensions.geometry, 'valid'),
                ($1, 'Arhiv', 'SI', $3::jsonb::text::extensions.geometry, 'valid')`,
        [ids.orgA, JSON.stringify(square(14.861234567, 45.641234567)), JSON.stringify(square(14.9, 45.7))],
      );
      await c.query("update plots set archived_at = now() where label = 'Arhiv'");
      const { rows } = await c.query<{ fc: { features: { properties: { label: string }; geometry: { coordinates: number[][][] } }[] } }>(
        'select public.plots_map($1) fc',
        [ids.orgA],
      );
      const labels = rows[0]!.fc.features.map((f) => f.properties.label).sort();
      expect(labels).toEqual(['Fino', 'P1']);
      const fino = rows[0]!.fc.features.find((f) => f.properties.label === 'Fino')!;
      expect(JSON.stringify(fino.geometry)).not.toMatch(/\d\.\d{7,}/);
    });
  });
});

describe('plots_in_bbox', () => {
  it('finds plots whose box overlaps and can exclude one', async () => {
    await asUser(ids.alice, async (c) => {
      const ins = await c.query<{ id: string }>(
        `insert into plots (organization_id, label, country, geom, validation_status)
         values ($1, 'Blizu', 'SI', $2::jsonb::text::extensions.geometry, 'valid') returning id`,
        [ids.orgA, JSON.stringify(square(14.80, 45.60))],
      );
      const id = ins.rows[0]!.id;
      const hit = await c.query<{ id: string; geom: { type: string } }>('select * from public.plots_in_bbox($1, 14.8005, 45.6005, 14.81, 45.61)', [ids.orgA]);
      expect(hit.rows.map((r) => r.id)).toEqual([id]);
      expect(hit.rows[0]!.geom.type).toBe('Polygon');
      const excluded = await c.query('select * from public.plots_in_bbox($1, 14.8005, 45.6005, 14.81, 45.61, $2)', [ids.orgA, id]);
      expect(excluded.rowCount).toBe(0);
      const far = await c.query('select * from public.plots_in_bbox($1, 15.5, 46.5, 15.6, 46.6)', [ids.orgA]);
      expect(far.rowCount).toBe(0);
    });
  });
});

describe('geometry input', () => {
  // The app always sends GeoJSON with an explicit crs: PostGIS versions disagree on the default SRID without it.
  it('stores GeoJSON with an EPSG:4326 crs as SRID 4326', async () => {
    await asUser(ids.alice, async (c) => {
      const g = { type: 'Point', coordinates: [14.505751, 46.049865], crs: { type: 'name', properties: { name: 'EPSG:4326' } } };
      const { rows } = await c.query<{ srid: number }>(
        "insert into plots (organization_id, label, country, geom, validation_status) values ($1, 'T', 'SI', $2::text::extensions.geometry, 'warning') returning extensions.st_srid(geom) srid",
        [ids.orgA, JSON.stringify(g)],
      );
      expect(rows[0]!.srid).toBe(4326);
    });
  });
});

describe('plot-imports bucket', () => {
  it('is private and scoped to the organization folder', async () => {
    const { rows } = await pool.query("select public, file_size_limit from storage.buckets where id = 'plot-imports'");
    expect(rows[0]).toMatchObject({ public: false, file_size_limit: '52428800' });
    await asUser(ids.alice, async (c) => {
      await c.query("insert into storage.objects (bucket_id, name) values ('plot-imports', $1)", [`${ids.orgA}/imp-1/parcele.zip`]);
      await expectSqlError(c, "insert into storage.objects (bucket_id, name) values ('plot-imports', $1)", [`${ids.orgB}/imp-1/x.zip`], '42501');
    });
  });
});
