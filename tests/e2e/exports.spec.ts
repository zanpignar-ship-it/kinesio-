import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

const user = newUser();

test('plots and shipments can be exported for Excel', async ({ page }) => {
  await signUpWithOrganization(page, user, 'Žaga Izvoz');
  const { client, organizationId } = await supabaseAs(user);
  await client.from('plots').insert({
    organization_id: organizationId, label: 'Gozd Šentjur', country: 'SI', validation_status: 'warning', validation_issues: [], area_ha: 2, area_source: 'declared',
    harvest_from: '2026-01-05', geom: { type: 'Point', crs, coordinates: [15.401234, 46.221234] } as unknown as string,
  });
  await client.from('shipments').insert({ organization_id: organizationId, internal_ref: 'IZ-1', mode: 'submit_dds', activity: 'export', country_of_production: 'SI' });

  await page.goto('/sl/app/plots');
  let download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Izvozi v Excel (CSV)' }).click();
  const plots = readFileSync(await (await download).path(), 'utf8');
  expect(plots.startsWith('﻿label;status;country;supplier')).toBe(true);
  expect(plots).toContain('Gozd Šentjur;warning;SI;;2;Point;46.221234;15.401234;2026-01-05');

  await page.goto('/sl/app/shipments');
  download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Izvozi v Excel (CSV)' }).click();
  const ships = readFileSync(await (await download).path(), 'utf8');
  expect(ships).toContain('IZ-1;draft');
});
