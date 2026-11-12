import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

const user = newUser();

test('plots of a shipment can be picked on the map', async ({ page }) => {
  await signUpWithOrganization(page, user, 'Žaga Karta');
  const { client, organizationId } = await supabaseAs(user);
  const ring = [[14.5, 46.05], [14.503, 46.05], [14.503, 46.052], [14.5, 46.052], [14.5, 46.05]];
  await client.from('plots').insert({
    organization_id: organizationId, label: 'Parcela na karti', country: 'SI', validation_status: 'valid', validation_issues: [],
    area_ha: 4, area_source: 'computed', geom: { type: 'Polygon', crs, coordinates: [ring] } as unknown as string,
  });

  await page.goto('/sl/app/shipments/new');
  await expect(page.getByText('Izbranih: 0')).toBeVisible();
  await page.getByRole('button', { name: 'Izberi na karti' }).click();
  const map = page.getByTestId('plot-picker-map');
  await expect(map.locator('[data-plots-rendered]')).toBeVisible({ timeout: 20_000 });
  const box = (await map.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText('Izbranih: 1')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Parcela na karti' })).toBeChecked();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByText('Izbranih: 0')).toBeVisible();
});
