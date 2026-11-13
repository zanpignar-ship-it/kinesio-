import { expect, test } from '@playwright/test';
import { newUser, signUpWithOrganization } from './helpers/auth';

test('a new organization loads sample data with one click', async ({ page }) => {
  await signUpWithOrganization(page, newUser(), 'Žaga Primer');
  await page.getByTestId('sample').getByRole('button', { name: 'Naloži primer podatkov' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PRIMER-1', { timeout: 15_000 });
  await expect(page.getByTestId('dds-scientificName')).toHaveText('Picea abies');
  await expect(page.getByTestId('dds-productionPeriod')).toHaveText('2026-01-12 – 2026-02-20');
  await page.goto('/sl/app/plots');
  await expect(page.getByTestId('plot-row')).toHaveCount(2);
  await page.goto('/sl/app');
  await expect(page.getByTestId('sample')).toHaveCount(0);
});
