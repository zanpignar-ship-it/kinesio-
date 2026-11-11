import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const user = newUser();
let shareUrl = '';

test('the owner downloads the buyer PDF and creates a buyer link', async ({ page }) => {
  await signUpWithOrganization(page, user, 'Žaga Čšž d.o.o.');
  const { client, organizationId } = await supabaseAs(user);
  const ring = [[14.861234, 45.641234], [14.862514, 45.641234], [14.862514, 45.642134], [14.861234, 45.642134], [14.861234, 45.641234]];
  const plot = await client
    .from('plots')
    .insert({ organization_id: organizationId, label: 'Gozd Č', country: 'SI', validation_status: 'valid', validation_issues: [], area_ha: 1, area_source: 'computed', geom: { type: 'Polygon', crs, coordinates: [ring] } as unknown as string })
    .select('id')
    .single();
  const ship = await client.from('shipments').insert({ organization_id: organizationId, internal_ref: 'B-1', mode: 'submit_dds', activity: 'export', country_of_production: 'SI' }).select('id').single();
  await client.from('shipment_plots').insert({ organization_id: organizationId, shipment_id: ship.data!.id, plot_id: plot.data!.id, geom_snapshot: { type: 'Polygon', crs, coordinates: [ring] } as unknown as string });

  await page.goto(`/sl/app/shipments/${ship.data!.id}`);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Prenesi PDF' }).click();
  const pdf = readFileSync(await (await download).path());
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(5000);

  await page.getByRole('button', { name: 'Ustvari povezavo za kupca' }).click();
  shareUrl = (await page.getByTestId('share-url').textContent()) ?? '';
  expect(shareUrl).toMatch(/\/sl\/share\/[\w-]{43}$/);
  await expect(page.getByText(/Velja do/)).toBeVisible();
});

test('an invalid buyer link shows a clear message', async ({ page }) => {
  await page.goto('/sl/share/neveljavna-povezava-1234567890abcdef');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Povezava ni veljavna ali je potekla.');
});

// Needs supabase/migrations/20261112000004_buyer_package.sql on the Supabase project (to be applied with the owner's confirmation).
test.fixme('the buyer opens the link without signing in', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(new URL(shareUrl).pathname);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Žaga Čšž d.o.o.');
  await expect(page.getByTestId('share-shipment')).toHaveCount(1);
  await expect(page.getByTestId('share-dds')).toHaveText('Izjava še ni oddana.');
  await context.close();
});
