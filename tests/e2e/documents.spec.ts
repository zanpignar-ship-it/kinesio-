import { expect, test } from '@playwright/test';
import { crs, newUser, signIn, signUpWithOrganization, supabaseAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const user = newUser();
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');

test('upload a felling permit linked to a plot', async ({ page }) => {
  await signUpWithOrganization(page, user);
  const { client, organizationId } = await supabaseAs(user);
  const { error } = await client.from('plots').insert({
    organization_id: organizationId, label: 'Gozd Rog', country: 'SI', validation_status: 'valid', validation_issues: [],
    geom: { type: 'Point', crs, coordinates: [14.86, 45.64] } as unknown as string,
  });
  expect(error).toBeNull();

  await page.goto('/sl/app/documents/new');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nov dokument');
  await page.getByLabel('Datoteka (PDF ali fotografija)').setInputFiles({ name: 'dovoljenje.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByLabel('Naziv').fill('Dovoljenje za posek 2026');
  await page.getByLabel('Vrsta').selectOption('felling_permit');
  await page.getByLabel('Velja od').fill('2026-01-01');
  await page.getByLabel('Velja do').fill('2099-12-31');
  await page.getByLabel('Gozd Rog').check();
  await page.getByRole('button', { name: 'Shrani dokument' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dovoljenje za posek 2026');
  await expect(page.getByRole('link', { name: 'Gozd Rog' })).toBeVisible();

  const href = await page.getByRole('link', { name: 'Odpri' }).getAttribute('href');
  expect(href).toContain('/storage/v1/object/sign/documents/');
  expect((await page.request.get(href!)).status()).toBe(200);

  await page.getByRole('link', { name: 'Gozd Rog' }).click();
  await expect(page.getByRole('link', { name: 'Dovoljenje za posek 2026' })).toBeVisible();
});

test('an expired document is flagged in the list and on the dashboard nothing expires soon', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/sl/app/documents/new');
  await page.getByLabel('Datoteka (PDF ali fotografija)').setInputFiles({ name: 'stara.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByLabel('Naziv').fill('Stara odločba');
  await page.getByLabel('Vrsta').selectOption('decision');
  await page.getByLabel('Velja do').fill('2020-01-01');
  await page.getByRole('button', { name: 'Shrani dokument' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stara odločba');
  await page.goto('/sl/app/documents');
  await expect(page.getByTestId('document-row')).toHaveCount(2);
  await expect(page.getByTestId('document-row').filter({ hasText: 'Stara odločba' })).toContainText('Potekel');
  await page.goto('/sl/app');
  await expect(page.getByText('Noben dokument ne poteče v naslednjih 30 dneh.')).toBeVisible();
});

test('a document can be deleted', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/sl/app/documents');
  await page.getByRole('link', { name: 'Stara odločba' }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Izbriši' }).click();
  await expect(page).toHaveURL(/\/sl\/app\/documents$/);
  await expect(page.getByTestId('document-row')).toHaveCount(1);
});
