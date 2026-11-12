import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

const user = newUser();

test('supplier and harvest dates are set on several plots at once', async ({ page }) => {
  await signUpWithOrganization(page, user, 'Žaga Množično');
  const { client, organizationId } = await supabaseAs(user);
  await client.from('suppliers').insert({ organization_id: organizationId, name: 'Gozdno gospodarstvo', kind: 'company', country: 'SI' });
  const plot = (label: string, x: number) => ({
    organization_id: organizationId, label, country: 'SI', validation_status: 'warning' as const, validation_issues: [], area_ha: 1, area_source: 'declared',
    geom: { type: 'Point', crs, coordinates: [14.5 + x, 46.05] } as unknown as string,
  });
  await client.from('plots').insert([plot('A1', 0), plot('A2', 0.01), plot('A3', 0.02)]);

  await page.goto('/sl/app/plots');
  await page.getByRole('checkbox', { name: 'Izberi A1' }).check();
  await page.getByRole('checkbox', { name: 'Izberi A2' }).check();
  const bar = page.getByTestId('bulk-bar');
  await bar.getByLabel('Dobavitelj').selectOption({ label: 'Gozdno gospodarstvo' });
  await bar.getByLabel('Obdobje poseka – Od').fill('2026-02-01');
  await bar.getByRole('button', { name: 'Uporabi za izbrane' }).click();
  await expect(bar.getByText('Posodobljenih parcel: 2.')).toBeVisible();

  const { data } = await client.from('plots').select('label, harvest_from, supplier:suppliers (name)').eq('organization_id', organizationId).order('label');
  expect(data!.map((p) => [p.label, p.harvest_from, p.supplier?.name ?? null])).toEqual([
    ['A1', '2026-02-01', 'Gozdno gospodarstvo'],
    ['A2', '2026-02-01', 'Gozdno gospodarstvo'],
    ['A3', null, null],
  ]);

  await page.getByRole('button', { name: 'Uporabi za izbrane' }).click();
  await expect(bar.getByText('Najprej izberite parcele (kljukice na seznamu).')).toBeVisible();
});
