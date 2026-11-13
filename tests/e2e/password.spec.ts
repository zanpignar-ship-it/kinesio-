import { expect, test } from '@playwright/test';
import { newUser, signIn, signUpWithOrganization } from './helpers/auth';

const user = newUser();

test('forgot password answers the same for any address', async ({ page }) => {
  await page.goto('/sl/login');
  await page.getByRole('link', { name: 'Pozabljeno geslo?' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pozabljeno geslo');
  await page.getByLabel('E-pošta').fill(`nobody-${Date.now()}@lestrace.test`);
  await page.getByRole('button', { name: 'Pošlji povezavo' }).click();
  await expect(page.getByRole('status').or(page.getByRole('alert').filter({ hasText: 'Preveč poskusov' }))).toBeVisible();
});

test('the new-password page needs a session; a signed-in user can change the password', async ({ page, browser }) => {
  const anon = await (await browser.newContext()).newPage();
  await anon.goto('/sl/update-password');
  await expect(anon).toHaveURL(/\/sl\/forgot-password$/);

  await signUpWithOrganization(page, user, 'Žaga Geslo');
  await page.goto('/sl/update-password');
  const next = `${user.password}-novo`;
  await page.getByLabel('Novo geslo').fill(next);
  await page.getByRole('button', { name: 'Shrani geslo' }).click();
  await page.waitForURL('**/sl/app');

  const fresh = await (await browser.newContext()).newPage();
  await signIn(fresh, { email: user.email, password: next });
});
