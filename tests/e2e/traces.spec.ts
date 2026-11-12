import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const user = newUser();

// Uses the real EUDR acceptance server with made-up credentials: it must answer with an authentication error.
test('the owner stores TRACES credentials and the connection test reaches the EU server', async ({ page }) => {
  test.setTimeout(90_000);
  await signUpWithOrganization(page, user, 'Žaga TRACES');
  await page.goto('/sl/app/settings');
  const box = page.getByTestId('traces-settings');
  await box.getByLabel('Uporabniško ime (EU Login)').fill('lestrace-e2e-user');
  await box.getByLabel('Avtentikacijski ključ (Authentication Key)').fill('not-a-real-key');
  await expect(box.getByLabel('WebServiceClientId')).toHaveValue('eudr-test');
  await box.getByRole('button', { name: 'Shrani' }).click();
  await expect(box.getByText('Shranjeno.')).toBeVisible();
  await page.reload();
  await expect(box.getByLabel('Uporabniško ime (EU Login)')).toHaveValue('lestrace-e2e-user');
  await expect(box.getByLabel('Avtentikacijski ključ (Authentication Key)')).toHaveValue('');
  await box.getByRole('button', { name: 'Preizkusi povezavo' }).click();
  await expect(page.getByTestId('traces-test')).toContainText('Povezava ne deluje', { timeout: 60_000 });
  await expect(page.getByTestId('traces-test')).toContainText(/Unauthenticated|Authentication/i);
});

test('submitting a ready shipment reaches TRACES and shows its answer', async ({ page }) => {
  test.setTimeout(90_000);
  const { client, organizationId } = await supabaseAs(user);
  // the key must never be readable in plain text
  const { data: cred } = await client.from('traces_credentials').select('auth_key_enc').single();
  expect(cred!.auth_key_enc).not.toContain('not-a-real-key');

  const { data: species } = await client.from('species').select('id').eq('scientific_name', 'Picea abies').single();
  const product = await client.from('products').insert({ organization_id: organizationId, name: 'Hlodovina smreka', hs_code: '4403', species_id: species!.id }).select('id').single();
  const plot = await client
    .from('plots')
    .insert({ organization_id: organizationId, label: 'Gozd T', country: 'SI', validation_status: 'valid', validation_issues: [], area_ha: 1.2, area_source: 'declared', harvest_from: '2026-01-10', geom: { type: 'Point', crs, coordinates: [14.512345, 46.051234] } as unknown as string })
    .select('id')
    .single();
  const ship = await client.from('shipments').insert({ organization_id: organizationId, internal_ref: 'T-1', mode: 'submit_dds', activity: 'export', country_of_production: 'SI' }).select('id').single();
  const id = ship.data!.id;
  await client.from('shipment_items').insert({ organization_id: organizationId, shipment_id: id, product_id: product.data!.id, net_mass_kg: 1000 });
  await client.from('shipment_plots').insert({ organization_id: organizationId, shipment_id: id, plot_id: plot.data!.id, geom_snapshot: { type: 'Point', crs, coordinates: [14.512345, 46.051234] } as unknown as string });

  await page.goto('/sl/login');
  await page.getByLabel('E-pošta').fill(user.email);
  await page.getByLabel('Geslo').fill(user.password);
  await page.getByRole('button', { name: 'Prijava' }).click();
  await page.waitForURL('**/sl/app');
  await page.goto(`/sl/app/shipments/${id}`);
  const panel = page.getByTestId('traces-panel');
  await expect(panel).toContainText('Najprej odpravite napake');
  await page.getByRole('button', { name: 'Označi kot pripravljeno' }).click();
  await expect(page.getByText('Pripravljeno', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Oddaj v testni TRACES (Acceptance)' }).click();
  await expect(panel.getByRole('alert')).toContainText('TRACES je zavrnil zahtevo.', { timeout: 60_000 });
  await expect(panel.getByRole('alert')).toContainText(/Unauthenticated|Authentication/i);
});
