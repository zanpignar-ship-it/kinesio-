import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

type M = { auth: { signInTitle: string; signUpTitle: string; errors: { email: string } }; home: { cta: string } };
const msg = (l: string) => JSON.parse(readFileSync(new URL(`../../messages/${l}.json`, import.meta.url), 'utf8')) as M;

test('a signed-out visitor of /sl/app is sent to the login with next', async ({ page }) => {
  await page.goto('/sl/app');
  await expect(page).toHaveURL(/\/sl\/login\?next=%2Fapp$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(msg('sl').auth.signInTitle);
});

test('a signed-out visitor of /sl/onboarding is sent to the login', async ({ page }) => {
  await page.goto('/sl/onboarding');
  await expect(page).toHaveURL(/\/sl\/login\?next=%2Fonboarding$/);
});

test('the login validates the e-mail in the page language', async ({ page }) => {
  await page.goto('/sl/login');
  await page.getByLabel('E-pošta').fill('ni-email');
  await page.getByLabel('Geslo').fill('x');
  await page.getByRole('button', { name: 'Prijava' }).click();
  await expect(page.getByText(msg('sl').auth.errors.email)).toBeVisible();
});

test('login and sign-up link to each other, in English too', async ({ page }) => {
  await page.goto('/en/login');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(msg('en').auth.signInTitle);
  await page.getByRole('link', { name: msg('en').auth.signUpTitle }).click();
  await expect(page).toHaveURL(/\/en\/signup$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(msg('en').auth.signUpTitle);
});

test('the login page fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sl/login');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the home page links to sign-up and login', async ({ page }) => {
  await page.goto('/sl');
  await page.getByRole('link', { name: msg('sl').home.cta }).first().click();
  await expect(page).toHaveURL(/\/sl\/signup$/);
  await page.goto('/sl');
  await page.getByRole('link', { name: msg('sl').auth.signInTitle }).click();
  await expect(page).toHaveURL(/\/sl\/login$/);
});
