import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { expect, test } from '@playwright/test';
import { crs, newUser, signIn, signUpWithOrganization, supabaseAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const user = newUser();

test('legal pages are public and linked from the footer', async ({ page }) => {
  await page.goto('/sl');
  await page.getByRole('link', { name: 'Pogoji uporabe' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pogoji uporabe');
  await expect(page.getByText('Odgovornost uporabnika')).toBeVisible();
  await page.goto('/en/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy');
});

test('the owner edits the organization and downloads the archive', async ({ page }) => {
  await signUpWithOrganization(page, user, 'Žaga Arhiv');
  const { client, organizationId } = await supabaseAs(user);
  await client.from('plots').insert({
    organization_id: organizationId, label: 'Arhivska parcela', country: 'SI', validation_status: 'valid', validation_issues: [],
    geom: { type: 'Point', crs, coordinates: [14.5, 46.05] } as unknown as string,
  });

  await page.goto('/sl/app');
  await expect(page.getByTestId('plot-counts').getByRole('link', { name: /Veljavne/ })).toContainText('1');
  await expect(page.getByText('Še nimate pošiljk.')).toBeVisible();
  await expect(page.getByTestId('todo')).toContainText('Parcele brez datuma poseka1');
  await expect(page.getByTestId('todo')).toContainText('Parcele brez dobavitelja1');

  await page.goto('/sl/app/settings');
  await page.getByLabel('Ime podjetja', { exact: true }).fill('Žaga Arhiv 2');
  await page.getByRole('button', { name: 'Shrani spremembe' }).click();
  await expect(page.getByRole('status')).toHaveText('Shranjeno.');
  await page.reload();
  await expect(page.getByLabel('Ime podjetja', { exact: true })).toHaveValue('Žaga Arhiv 2');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Prenesi arhiv (ZIP)' }).click();
  const zip = await JSZip.loadAsync(readFileSync(await (await download).path()));
  const fc = JSON.parse(await zip.file('plots.geojson')!.async('string')) as { features: { properties: { label: string }; geometry: { type: string } }[] };
  expect(fc.features.map((f) => f.properties.label)).toEqual(['Arhivska parcela']);
  expect(fc.features[0]!.geometry.type).toBe('Point');
  expect(zip.file('audit_log.csv')).not.toBeNull();

  await page.getByRole('link', { name: 'Revizijska sled' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revizijska sled');
  const list = page.getByTestId('audit-list');
  await expect(list).toContainText('Dodano · Parcela');
  await expect(list).toContainText('Arhivska parcela');
  await expect(list).toContainText('Spremenjeno · Organizacija');
  await expect(list).toContainText('polja: name');
  await expect(list).toContainText(user.email);
});

test('account deletion asks for the email address', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/sl/app/settings');
  await page.getByLabel(/Za potrditev vpišite/).fill('napacen@naslov.test');
  await page.getByRole('button', { name: 'Trajno izbriši račun' }).click();
  await expect(page.getByText('Vpisani e-naslov se ne ujema.')).toBeVisible();
});

test('a user can delete their account with the organization', async ({ page, browser }) => {
  const victim = newUser();
  await signUpWithOrganization(page, victim, 'Žaga za izbris');
  await page.goto('/sl/app/settings');
  await page.getByLabel(/Za potrditev vpišite/).fill(victim.email);
  await page.getByRole('button', { name: 'Trajno izbriši račun' }).click();
  await page.waitForURL(/\/sl(\?deleted=1)?$/);
  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto('/sl/login');
  await fresh.getByLabel('E-pošta').fill(victim.email);
  await fresh.getByLabel('Geslo').fill(victim.password);
  await fresh.getByRole('button', { name: 'Prijava' }).click();
  await expect(fresh.getByText('E-pošta ali geslo ni pravilno.')).toBeVisible();
});
