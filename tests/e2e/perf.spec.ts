import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const user = newUser();

test('1,000 plots: the list loads in under 2 s and the map in under 3 s', async ({ page }) => {
  test.setTimeout(120_000);
  await signUpWithOrganization(page, user);
  const { client, organizationId } = await supabaseAs(user);
  // 1,000 small polygons around Ljubljana (40 x 25 grid), inserted in batches of 250.
  const rows = Array.from({ length: 1000 }, (_, i) => {
    const lon = 14.3 + (i % 40) * 0.005;
    const lat = 45.95 + Math.floor(i / 40) * 0.005;
    const ring = [[lon, lat], [lon + 0.003, lat], [lon + 0.003, lat + 0.003], [lon, lat + 0.003], [lon, lat]];
    return {
      organization_id: organizationId,
      label: `P${String(i).padStart(4, '0')}`,
      country: 'SI',
      geom: { type: 'Polygon', crs, coordinates: [ring] } as unknown as string,
      validation_status: (i % 10 === 0 ? 'warning' : 'valid') as 'valid' | 'warning',
      validation_issues: [],
      area_ha: 7,
      area_source: 'computed',
    };
  });
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await client.from('plots').insert(rows.slice(i, i + 250));
    expect(error).toBeNull();
  }

  const listStart = Date.now();
  await page.goto('/sl/app/plots');
  await expect(page.getByTestId('count-all')).toHaveText('1000');
  await expect(page.getByTestId('plot-row').first()).toBeVisible();
  const listMs = Date.now() - listStart;

  await expect.poll(() => page.getByTestId('plot-map').getAttribute('data-plots-rendered'), { timeout: 10_000 }).not.toBeNull();
  const mapMs = Date.now() - listStart;
  test.info().annotations.push({ type: 'timing', description: `list ${listMs} ms, map ${mapMs} ms` });
  console.log(`list ${listMs} ms, map ${mapMs} ms`);
  expect(listMs).toBeLessThan(2000);
  expect(mapMs).toBeLessThan(3000);
});
