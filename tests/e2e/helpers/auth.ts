import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, type Page } from '@playwright/test';
import type { Database } from '../../../src/lib/db/database.types';

export type E2EUser = { email: string; password: string };

/** Fresh user for one test file; all e2e users use the lestrace.test domain and are removed by scripts/cleanup-e2e.sql. */
export function newUser(): E2EUser {
  return { email: `e2e+${randomBytes(6).toString('hex')}@lestrace.test`, password: `Pw-${randomBytes(9).toString('hex')}` };
}

/** Sign up through the UI and create an organization; leaves the page on the dashboard. */
export async function signUpWithOrganization(page: Page, user: E2EUser, orgName = 'E2E Žaga'): Promise<void> {
  await page.goto('/sl/signup');
  await page.getByLabel('E-pošta').fill(user.email);
  await page.getByLabel('Geslo').fill(user.password);
  await page.getByRole('button', { name: 'Ustvari račun' }).click();
  await expect(page).toHaveURL(/\/sl\/onboarding$/, { timeout: 15_000 });
  await page.getByLabel('Ime podjetja').fill(orgName);
  await page.getByRole('button', { name: 'Ustvari organizacijo' }).click();
  await expect(page).toHaveURL(/\/sl\/app$/, { timeout: 15_000 });
}

/** Supabase client signed in as the e2e user (RLS applies), for setting up data quickly. */
export async function supabaseAs(user: E2EUser): Promise<{ client: SupabaseClient<Database>; organizationId: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing for e2e');
  const client = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword(user);
  if (error) throw error;
  const { data } = await client.from('memberships').select('organization_id').limit(1).single();
  if (!data) throw new Error('no organization');
  return { client, organizationId: data.organization_id };
}

export const crs = { type: 'name', properties: { name: 'EPSG:4326' } } as const;

/** Sign in through the UI and wait until the app is open. */
export async function signIn(page: Page, user: E2EUser): Promise<void> {
  await page.goto('/sl/login');
  await page.getByLabel('E-pošta').fill(user.email);
  await page.getByLabel('Geslo').fill(user.password);
  await page.getByRole('button', { name: 'Prijava' }).click();
  await expect(page).toHaveURL(/\/sl\/app$/, { timeout: 15_000 });
}
