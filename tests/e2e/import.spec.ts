import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { newUser, signIn, signUpWithOrganization } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const user = newUser();
const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url).pathname;

test('import a Slovenian Excel CSV', async ({ page }) => {
  await signUpWithOrganization(page, user);
  await page.goto('/sl/app/plots/import');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Uvoz parcel');
  await page.getByLabel('Izberite datoteko').setInputFiles(fixture('plots-sl.csv'));
  await expect(page.getByText('1 parcel v datoteki')).toBeVisible();
  await expect(page.getByTestId('import-row')).toHaveCount(1);
  await page.getByRole('button', { name: /Shrani parcele \(1\)/ }).click();
  await expect(page.getByText('Shranjenih parcel: 1.')).toBeVisible();
  await page.getByRole('link', { name: 'Na seznam parcel' }).click();
  await expect(page.getByRole('link', { name: 'Parcela 1' })).toBeVisible();
});

test('a shapefile without .prj needs the coordinate system before saving', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/sl/app/plots/import');
  await page.getByLabel('Izberite datoteko').setInputFiles(fixture('plots-d96-noprj.zip'));
  await expect(page.getByText('V katerem koordinatnem sistemu je datoteka?')).toBeVisible();
  await expect(page.getByRole('button', { name: /Shrani parcele/ })).toBeDisabled();
  await page.getByLabel(/D96\/TM/).check();
  await expect(page.getByRole('button', { name: /Shrani parcele \(1\)/ })).toBeEnabled();
});

test('import 500 points at once', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/sl/app/plots/import');
  const lines = ['ime;širina;dolžina;površina'];
  for (let i = 0; i < 500; i++) {
    const lat = (45.95 + (i % 25) * 0.01).toFixed(6).replace('.', ',');
    const lon = (14.4 + Math.floor(i / 25) * 0.01).toFixed(6).replace('.', ',');
    lines.push(`T${i};${lat};${lon};${i === 0 ? '9' : '1'}`);
  }
  await page.getByLabel('Izberite datoteko').setInputFiles({ name: 'tocke.csv', mimeType: 'text/csv', buffer: Buffer.from(lines.join('\n')) });
  await expect(page.getByText('500 parcel v datoteki')).toBeVisible();
  await expect(page.getByTestId('import-count-error')).toHaveText(/1/);
  const started = Date.now();
  await page.getByRole('button', { name: /Shrani parcele \(499\)/ }).click();
  await expect(page.getByText('Shranjenih parcel: 499.')).toBeVisible({ timeout: 20_000 });
  expect(Date.now() - started).toBeLessThan(10_000);
  void readFileSync;
});
