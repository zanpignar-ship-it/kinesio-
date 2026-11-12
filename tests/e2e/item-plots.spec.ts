import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

const user = newUser();

test('each product of a shipment can come from its own plots', async ({ page }) => {
  await signUpWithOrganization(page, user, 'Žaga Izdelki');
  const { client, organizationId } = await supabaseAs(user);
  const { data: species } = await client.from('species').select('id').eq('scientific_name', 'Picea abies').single();
  await client.from('products').insert([
    { organization_id: organizationId, name: 'Hlodi', hs_code: '4403', species_id: species!.id },
    { organization_id: organizationId, name: 'Deske', hs_code: '4407', species_id: species!.id },
  ]);
  const plot = (label: string, x: number) => ({
    organization_id: organizationId, label, country: 'SI', validation_status: 'valid' as const, validation_issues: [], area_ha: 1, area_source: 'declared',
    geom: { type: 'Point', crs, coordinates: [14.5 + x, 46.05] } as unknown as string,
  });
  const { data: plots } = await client.from('plots').insert([plot('Gozd 1', 0), plot('Gozd 2', 0.01)]).select('id, label');

  await page.goto('/sl/app/shipments/new');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Interna oznaka').fill('IP-1');
  await page.getByLabel('Izdelek').selectOption({ label: 'Hlodi (4403)' });
  await page.getByLabel('Neto masa (kg)').fill('1000');
  await page.getByRole('button', { name: 'Dodaj izdelek' }).click();
  await page.locator('#product-1').selectOption({ label: 'Deske (4407)' });
  await page.locator('#netMassKg-1').fill('500');
  await page.getByRole('checkbox', { name: 'Gozd 1' }).check();
  await page.getByRole('checkbox', { name: 'Gozd 2' }).check();
  const second = page.getByTestId('item-plots-1');
  await second.getByText('Parcele tega izdelka: vse').click();
  await second.getByRole('checkbox', { name: 'Gozd 1' }).uncheck();
  await expect(second.getByText('Parcele tega izdelka: 1 od 2')).toBeVisible();
  await page.getByRole('button', { name: 'Shrani pošiljko' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('IP-1');

  const gozd2 = plots!.find((p) => p.label === 'Gozd 2')!.id;
  const { data: items } = await client.from('shipment_items').select('net_mass_kg, plot_ids').eq('organization_id', organizationId).order('net_mass_kg');
  expect(items!.map((i) => [Number(i.net_mass_kg), i.plot_ids])).toEqual([
    [500, [gozd2]],
    [1000, null],
  ]);
});
