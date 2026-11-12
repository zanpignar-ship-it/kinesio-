import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

const user = newUser();

test('a plot gets a supplier, which shows on the plot and filters the list', async ({ page }) => {
  await signUpWithOrganization(page, user, 'Žaga Dobavitelji');
  const { client, organizationId } = await supabaseAs(user);
  const supplier = await client.from('suppliers').insert({ organization_id: organizationId, name: 'Janez Novak', kind: 'forest_owner', country: 'SI' }).select('id').single();
  expect(supplier.error).toBeNull();
  const ins = await client
    .from('plots')
    .insert([
      { organization_id: organizationId, label: 'Novakov gozd', country: 'SI', validation_status: 'warning', validation_issues: [], area_ha: 1, area_source: 'declared', geom: { type: 'Point', crs, coordinates: [14.512345, 46.051234] } as unknown as string },
      { organization_id: organizationId, label: 'Drug gozd', country: 'SI', validation_status: 'warning', validation_issues: [], area_ha: 1, area_source: 'declared', geom: { type: 'Point', crs, coordinates: [14.612345, 46.151234] } as unknown as string },
    ])
    .select('id, label');
  const plot = ins.data!.find((p) => p.label === 'Novakov gozd')!;

  await page.goto(`/sl/app/plots/${plot.id}/edit`);
  await page.getByLabel('Dobavitelj').selectOption({ label: 'Janez Novak' });
  await page.getByLabel('Od', { exact: true }).fill('2026-01-10');
  await page.getByLabel('Do', { exact: true }).fill('2026-02-20');
  await page.getByRole('button', { name: 'Shrani parcelo' }).click();
  await page.waitForURL(`**/sl/app/plots/${plot.id}`);
  await expect(page.getByText('Janez Novak')).toBeVisible();
  await expect(page.getByText('10. jan. 2026 – 20. feb. 2026')).toBeVisible();

  await page.goto(`/sl/app/plots?supplier=${supplier.data!.id}`);
  await expect(page.getByTestId('plot-row')).toHaveCount(1);
  await expect(page.getByTestId('plot-row')).toContainText('Novakov gozd');
});
