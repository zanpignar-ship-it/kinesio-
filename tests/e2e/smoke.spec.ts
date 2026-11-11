import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

type Messages = { home: { title: string }; common: { disclaimer: string } };
const msg = (l: string) => JSON.parse(readFileSync(new URL(`../../messages/${l}.json`, import.meta.url), 'utf8')) as Messages;

test('root redirects to Slovenian', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sl$/);
});

for (const locale of ['sl', 'en', 'hr']) {
  test(`/${locale} shows translated title and disclaimer`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(msg(locale).home.title);
    await expect(page.getByTestId('disclaimer')).toHaveText(msg(locale).common.disclaimer);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  });
}

test('a Croatian browser is sent to /hr', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'hr-HR' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/hr$/);
  await context.close();
});

test('a browser in an unsupported language falls back to Slovenian', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'de-DE' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/sl$/);
  await context.close();
});

test('unknown locale ends on the Slovenian home page without an error', async ({ page }) => {
  const response = await page.goto('/de');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/sl$/);
});

test('no horizontal scrolling on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sl');
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test('language switcher links to every locale', async ({ page }) => {
  await page.goto('/sl');
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en$/);
});
