import { expect, test } from '@playwright/test';
import { newUser, signUpWithOrganization } from './helpers/auth';

test.describe.configure({ mode: 'serial' });
const owner = newUser();
const colleague = newUser();
const stranger = newUser();
let inviteUrl = '';

test('the owner creates an invitation link', async ({ page }) => {
  await signUpWithOrganization(page, owner, 'Žaga Vabila');
  await page.goto('/sl/app/settings');
  await expect(page.getByTestId('members')).toContainText(owner.email);
  await page.getByLabel('E-pošta').fill(colleague.email.toUpperCase());
  await page.getByRole('button', { name: 'Ustvari povabilo' }).click();
  inviteUrl = (await page.getByTestId('invite-url').textContent()) ?? '';
  expect(inviteUrl).toMatch(/\/sl\/invite\/[\w-]{43}$/);
  await page.reload();
  await expect(page.getByText('Odprta povabila')).toBeVisible();
});

test('someone with another e-mail cannot join', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(new URL(inviteUrl).pathname);
  await page.getByRole('link', { name: 'Ustvari račun' }).click();
  await page.getByLabel('E-pošta').fill(stranger.email);
  await page.getByLabel('Geslo').fill(stranger.password);
  await page.getByRole('button', { name: 'Ustvari račun' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pridružite se organizaciji Žaga Vabila');
  await expect(page.getByText(/Povabilo je namenjeno naslovu/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sprejmi povabilo' })).toHaveCount(0);
});

test('the colleague signs up from the link and joins as a member', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Povabilo v LesTrace');
  await page.getByRole('link', { name: 'Ustvari račun' }).click();
  await page.getByLabel('E-pošta').fill(colleague.email);
  await page.getByLabel('Geslo').fill(colleague.password);
  await page.getByRole('button', { name: 'Ustvari račun' }).click();
  await page.getByRole('button', { name: 'Sprejmi povabilo' }).click();
  await page.waitForURL('**/sl/app');
  await expect(page.getByText('Žaga Vabila', { exact: true })).toBeVisible();

  await page.goto('/sl/app/settings');
  await expect(page.getByText('Podatke lahko spreminja samo lastnik organizacije.')).toBeVisible();
  await expect(page.getByTestId('members')).toContainText(owner.email);
  await expect(page.getByRole('button', { name: 'Ustvari povabilo' })).toHaveCount(0);

  // a used link cannot be used again
  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Povabilo ni veljavno');
});
