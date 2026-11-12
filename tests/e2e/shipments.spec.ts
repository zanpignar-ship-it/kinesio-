import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { crs, newUser, signIn, signUpWithOrganization, supabaseAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const user = newUser();

test('master data: customer and product', async ({ page }) => {
  await signUpWithOrganization(page, user);
  await page.goto('/sl/app/master-data/customers');
  await page.getByLabel('Ime', { exact: true }).fill('Holz GmbH');
  await page.getByLabel('Država').selectOption('AT');
  await page.getByRole('button', { name: 'Shrani' }).click();
  await expect(page.getByTestId('record-row')).toHaveCount(1);

  await page.goto('/sl/app/master-data/products');
  await page.getByLabel('Ime', { exact: true }).fill('Hlodovina smreka');
  await page.getByLabel('HS koda').selectOption('4403');
  await page.getByLabel('Drevesna vrsta').selectOption({ label: 'Picea abies (navadna smreka)' });
  await page.getByRole('button', { name: 'Shrani' }).click();
  await expect(page.getByTestId('record-row')).toHaveCount(1);

  await page.getByLabel('Ime', { exact: true }).fill('Brez vrste');
  await page.getByLabel('HS koda').selectOption('4407');
  await page.getByRole('button', { name: 'Shrani' }).click();
  await expect(page.getByTestId('record-row')).toHaveCount(2);
});

test('shipment: checklist, GeoJSON, DDS data, submission and copy', async ({ page }) => {
  const { client, organizationId } = await supabaseAs(user);
  const ring = [[14.861234, 45.641234], [14.862514, 45.641234], [14.862514, 45.642134], [14.861234, 45.642134], [14.861234, 45.641234]];
  const plot = await client
    .from('plots')
    .insert({ organization_id: organizationId, label: 'Gozd A', country: 'SI', validation_status: 'valid', validation_issues: [], area_ha: 1, area_source: 'computed', harvest_from: '2026-01-10', harvest_to: '2026-02-20', geom: { type: 'Polygon', crs, coordinates: [ring] } as unknown as string })
    .select('id')
    .single();
  expect(plot.error).toBeNull();
  const doc = await client
    .from('documents')
    .insert({ organization_id: organizationId, type: 'felling_permit', title: 'Dovoljenje A', file_path: `${organizationId}/x/a.pdf`, mime: 'application/pdf', size_bytes: 10, valid_to: '2099-01-01' })
    .select('id')
    .single();
  await client.from('plot_documents').insert({ organization_id: organizationId, plot_id: plot.data!.id, document_id: doc.data!.id });

  await signIn(page, user);
  await page.goto('/sl/app/shipments/new');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Interna oznaka').fill('S-1');
  await page.getByLabel('Kupec').selectOption({ label: 'Holz GmbH' });
  await page.getByLabel('Dejavnost').selectOption('export');
  await page.getByLabel('Izdelek').selectOption({ label: 'Hlodovina smreka (4403)' });
  await page.getByLabel('Neto masa (kg)').fill('24000');
  await page.getByLabel('Gozd A').check();
  await page.getByLabel('Dovoljenje A').check();
  await page.getByRole('button', { name: 'Shrani pošiljko' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('S-1');
  await expect(page.getByTestId('checklist-ok')).toBeVisible();
  await expect(page.getByTestId('dds-hsCode')).toHaveText('4403');
  await expect(page.getByTestId('dds-scientificName')).toHaveText('Picea abies');
  await expect(page.getByTestId('dds-netMassKg')).toHaveText('24000');
  await expect(page.getByTestId('dds-productionPeriod')).toHaveText('2026-01-10 – 2026-02-20');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Prenesi GeoJSON' }).click();
  const file = await (await download).path();
  const fc = JSON.parse(readFileSync(file, 'utf8')) as { type: string; features: { properties: { ProductionPlace: string; ProducerCountry: string } }[] };
  expect(fc.type).toBe('FeatureCollection');
  expect(fc.features).toHaveLength(1);
  expect(fc.features[0]!.properties).toMatchObject({ ProductionPlace: 'Gozd A', ProducerCountry: 'SI' });
  expect(readFileSync(file, 'utf8')).not.toMatch(/\d\.\d{7,}/);

  await page.getByRole('button', { name: 'Označi kot pripravljeno' }).click();
  await expect(page.getByText('Pripravljeno', { exact: true })).toBeVisible();
  await page.getByLabel('Referenčna številka DDS').fill('26SI000123');
  await page.getByLabel('Verifikacijska številka').fill('VX12AB');
  await page.getByRole('button', { name: 'Shrani kot oddano' }).click();
  await expect(page.getByText('Oddano', { exact: true })).toBeVisible();
  await expect(page.getByText('DDS 26SI000123')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Uredi' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Kopiraj pošiljko (nov tovor)' }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByLabel('Interna oznaka')).toHaveValue('S-1-2');
  await page.getByRole('button', { name: 'Shrani pošiljko' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('S-1-2');
  await expect(page.getByText('Osnutek', { exact: true })).toBeVisible();
});

test('the checklist blocks a product without species', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/sl/app/shipments/new');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Interna oznaka').fill('S-2');
  await page.getByLabel('Izdelek').selectOption({ label: 'Brez vrste (4407)' });
  await page.getByLabel('Neto masa (kg)').fill('1000');
  await page.getByLabel('Gozd A').check();
  await page.getByRole('button', { name: 'Shrani pošiljko' }).click();
  await expect(page.getByTestId('check-speciesMissing')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Označi kot pripravljeno' })).toBeDisabled();
});
