import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { newUser, signIn, signUpWithOrganization, supabaseAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const owner = newUser();
let link = '';
let supplierId = '';

test('the owner creates a link for a supplier', async ({ page }) => {
  await signUpWithOrganization(page, owner, 'Žaga Portal');
  const { client, organizationId } = await supabaseAs(owner);
  const s = await client.from('suppliers').insert({ organization_id: organizationId, name: 'Janez Gozdar', kind: 'forest_owner', country: 'SI' }).select('id').single();
  supplierId = s.data!.id;
  await page.goto(`/sl/app/master-data/suppliers/${supplierId}`);
  const box = page.getByTestId('supplier-links');
  await box.getByRole('button', { name: 'Ustvari povezavo' }).click();
  link = (await box.getByTestId('supplier-link-url').textContent()) ?? '';
  expect(link).toMatch(/\/sl\/supply\/[\w-]{43}$/);
  await page.reload();
  await expect(box).toContainText('še ni bila odprta');
});

test('the supplier adds a plot and uploads a permit without an account', async ({ browser }) => {
  test.setTimeout(90_000);
  const page = await (await browser.newContext()).newPage();
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Podatki o poreklu lesa za Žaga Portal');

  const form = page.getByTestId('portal-plot-form');
  await form.getByRole('button', { name: 'Točka' }).click();
  const map = page.getByTestId('portal-map');
  await expect(map.locator('canvas')).toBeVisible({ timeout: 20_000 });
  const box = (await map.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await form.getByLabel(/Ime parcele/).fill('Gozd za hišo');
  await form.getByLabel('Površina (ha)').fill('1,5');
  await form.getByLabel('Obdobje poseka – Od').fill('2026-02-01');
  await form.getByRole('button', { name: 'Shrani parcelo' }).click();
  await expect(form.getByRole('status')).toHaveText('Parcela je shranjena. Kupec jo bo preveril.');
  await expect(page.getByTestId('portal-plots')).toContainText('Gozd za hišo');

  const pdf = join(tmpdir(), `odlocba-${Date.now()}.pdf`);
  writeFileSync(pdf, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const doc = page.getByTestId('portal-document-form');
  await doc.getByLabel('Datoteka (PDF ali fotografija)').setInputFiles(pdf);
  await doc.getByLabel('Naziv').fill('Odločba o poseku');
  await doc.getByLabel('Velja do').fill('2027-12-31');
  await doc.getByRole('checkbox', { name: 'Gozd za hišo' }).check();
  await doc.getByRole('button', { name: 'Naloži dokument' }).click();
  await expect(doc.getByRole('status')).toHaveText('Dokument je naložen.', { timeout: 20_000 });
  await page.reload();
  await expect(page.getByTestId('portal-documents')).toContainText('Odločba o poseku');
});

test('the owner reviews the supplier plot', async ({ page }) => {
  await signIn(page, owner);
  await page.goto('/sl/app/plots');
  const banner = page.getByTestId('awaiting-review');
  await expect(banner).toContainText('Parcel od dobaviteljev, ki čakajo na preverjanje: 1.');
  await banner.getByRole('button', { name: 'Preveri zdaj' }).click();
  await expect(page.getByTestId('awaiting-review')).toHaveCount(0);
  const { client } = await supabaseAs(owner);
  const { data: plot } = await client.from('plots').select('id, supplier_id, validation_issues, area_ha').eq('label', 'Gozd za hišo').single();
  expect(plot!.supplier_id).toBe(supplierId);
  expect(JSON.stringify(plot!.validation_issues)).not.toContain('SUPPLIER_SUBMITTED');
  expect(Number(plot!.area_ha)).toBe(1.5);
  const { data: docs } = await client.from('plot_documents').select('document:documents (title)').eq('plot_id', plot!.id);
  expect(docs!.map((d) => d.document?.title)).toEqual(['Odločba o poseku']);
});
