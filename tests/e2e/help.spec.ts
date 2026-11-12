import { expect, test } from '@playwright/test';
import { newUser, signUpWithOrganization } from './helpers/auth';

test('the help page explains the five steps and links to them', async ({ page }) => {
  await signUpWithOrganization(page, newUser(), 'Žaga Pomoč');
  await page.getByRole('link', { name: 'Pomoč' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kako začeti');
  await expect(page.getByTestId('help-steps').getByRole('listitem')).toHaveCount(5);
  await page.getByText('Točka ali poligon?').click();
  await expect(page.getByText(/Parcele nad 4 ha morajo biti vnesene kot poligon/)).toBeVisible();
  await page.getByRole('link', { name: 'Nova pošiljka →' }).click();
  await expect(page).toHaveURL(/\/sl\/app\/shipments\/new$/);
});
