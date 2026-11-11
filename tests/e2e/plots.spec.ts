import { expect, test } from '@playwright/test';
import { crs, newUser, signIn, signUpWithOrganization, supabaseAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });

const user = newUser();

test('a new organization sees an empty plot list', async ({ page }) => {
  await signUpWithOrganization(page, user);
  await page.getByRole('link', { name: 'Parcele' }).first().click();
  await expect(page).toHaveURL(/\/sl\/app\/plots$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Parcele');
  await expect(page.getByText('Še nimate parcel.')).toBeVisible();
});

test('the list shows status counts, filters and details', async ({ page }) => {
  const { client, organizationId } = await supabaseAs(user);
  const sq = (lon: number) => ({ type: 'Polygon', crs, coordinates: [[[lon, 45.64], [lon + 0.001, 45.64], [lon + 0.001, 45.641], [lon, 45.641], [lon, 45.64]]] });
  const { error } = await client.from('plots').insert([
    { organization_id: organizationId, label: 'Gozd A', country: 'SI', geom: sq(14.86) as unknown as string, validation_status: 'valid', validation_issues: [], area_ha: 0.87, area_source: 'computed' },
    { organization_id: organizationId, label: 'Gozd B', country: 'SI', geom: sq(14.87) as unknown as string, validation_status: 'warning', validation_issues: [{ code: 'POINT_POLYGON_RECOMMENDED', severity: 'warning' }] },
    { organization_id: organizationId, label: 'Gozd C', country: 'SI', geom: sq(14.88) as unknown as string, validation_status: 'error', validation_issues: [{ code: 'PRECISION_TOO_LOW', severity: 'error', params: { found: 4, required: 6 } }] },
  ]);
  expect(error).toBeNull();

  await signIn(page, user);
  await page.goto('/sl/app/plots');
  await expect(page.getByTestId('plot-row')).toHaveCount(3);
  await expect(page.getByTestId('count-error')).toHaveText(/1/);

  await page.getByRole('link', { name: /Z napako/ }).click();
  await expect(page).toHaveURL(/status=error/);
  await expect(page.getByTestId('plot-row')).toHaveCount(1);

  await page.getByRole('link', { name: 'Gozd C' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gozd C');
  await expect(page.getByText('Koordinate imajo le 4 decimalnih mest, zahtevanih je vsaj 6.')).toBeVisible();
});

test('a plot can be archived and disappears from the list', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/sl/app/plots');
  await page.getByRole('link', { name: 'Gozd B' }).click();
  await page.getByRole('button', { name: 'Arhiviraj' }).click();
  await expect(page).toHaveURL(/\/sl\/app\/plots$/);
  await expect(page.getByTestId('plot-row')).toHaveCount(2);
});
