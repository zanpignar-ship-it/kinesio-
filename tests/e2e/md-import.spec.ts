import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { newUser, signUpWithOrganization } from './helpers/auth';

test('suppliers are imported from a CSV file, existing ones are skipped', async ({ page }) => {
  await signUpWithOrganization(page, newUser(), 'Žaga Šifranti');
  const file = join(tmpdir(), `dobavitelji-${Date.now()}.csv`);
  writeFileSync(file, '﻿Ime in priimek;Naslov;Davčna številka\r\nJanez Novak;Kočevje;12345678\r\nGrča d.o.o.;Ljubljana;SI87654321\r\nJanez Novak;Kočevje;12345678\r\n', 'utf8');

  await page.goto('/sl/app/master-data/suppliers');
  const box = page.getByTestId('import-records');
  await box.getByText('Uvozi iz Excela ali CSV').click();
  await box.getByLabel('Datoteka CSV ali Excel').setInputFiles(file);
  await expect(box.getByText('Veljavnih zapisov v datoteki: 3.')).toBeVisible();
  await box.getByRole('button', { name: 'Uvozi zapise (3)' }).click();
  await expect(box.getByRole('status')).toHaveText('Uvoženih: 2, preskočenih (že obstajajo ali niso veljavni): 1.');
  await page.reload();
  await expect(page.getByTestId('record-row')).toHaveCount(2);
  await expect(page.getByTestId('record-row').first()).toContainText('Grča d.o.o.');
});
