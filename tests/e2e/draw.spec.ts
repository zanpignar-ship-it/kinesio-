import { expect, test } from '@playwright/test';
import { newUser, signIn, signUpWithOrganization } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const user = newUser();

test('draw a point on the satellite map and save it', async ({ page }) => {
  await signUpWithOrganization(page, user);
  const tiles = page.waitForResponse((r) => r.url().includes('server.arcgisonline.com') && r.status() === 200);
  await page.goto('/sl/app/plots/new');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nova parcela');
  await tiles;
  const map = page.getByTestId('plot-map');
  await expect(map.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Točka' }).click();
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByLabel('Oznaka').fill('Točka 1');
  await page.getByLabel('Površina (ha)').fill('2,5');
  await page.getByRole('button', { name: 'Shrani parcelo' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Točka 1');
  await expect(page.getByText('2,5 ha')).toBeVisible();
});

test('a polygon with two points cannot be saved', async ({ page }) => {
  await signIn(page, user);
  await page.goto('/sl/app/plots/new');
  const map = page.getByTestId('plot-map');
  await expect(map.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Poligon' }).click();
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2 + 40, box.y + box.height / 2);
  await expect(page.getByText('Poligon potrebuje vsaj 3 točke.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shrani parcelo' })).toBeDisabled();
  await page.mouse.click(box.x + box.width / 2 + 40, box.y + box.height / 2 + 40);
  await expect(page.getByRole('button', { name: 'Shrani parcelo' })).toBeEnabled();
  // The polygon itself is drawn on the map (fill layer has a rendered feature), not only its corners.
  await expect.poll(() =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="plot-map"]');
      return el?.getAttribute('data-draft-features');
    }),
  ).toBe('1');
  await expect.poll(() => map.getAttribute('data-draft-rendered'), { timeout: 10_000 }).not.toBe('0');
  await expect.poll(() => map.getAttribute('data-draft-rendered')).not.toBeNull();
});

test('the drawing page fits a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, user);
  await page.goto('/sl/app/plots/new');
  await expect(page.getByTestId('plot-map').locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: 'Razveljavi' })).toBeVisible();
});
