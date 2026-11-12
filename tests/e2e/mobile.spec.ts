import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

const user = newUser();
const PAGES = [
  '/sl/app', '/sl/app/plots', '/sl/app/plots/new', '/sl/app/plots/import', '/sl/app/documents', '/sl/app/documents/new',
  '/sl/app/shipments', '/sl/app/shipments/new', '/sl/app/master-data', '/sl/app/settings', '/sl/terms', '/sl/privacy',
];

test('main pages fit a phone screen without sideways scrolling', async ({ page }) => {
  test.setTimeout(120_000);
  await signUpWithOrganization(page, user, 'Žaga z zelo dolgim imenom podjetja d.o.o.');
  const { client, organizationId } = await supabaseAs(user);
  const plot = await client
    .from('plots')
    .insert({ organization_id: organizationId, label: 'Parcela z zelo dolgim imenom ki se mora prelomiti', country: 'SI', validation_status: 'warning', validation_issues: [], area_ha: 1, area_source: 'declared', geom: { type: 'Point', crs, coordinates: [14.512345, 46.051234] } as unknown as string })
    .select('id')
    .single();
  const ship = await client.from('shipments').insert({ organization_id: organizationId, internal_ref: 'M-2026-001', mode: 'submit_dds', activity: 'export', country_of_production: 'SI' }).select('id').single();
  await page.setViewportSize({ width: 390, height: 844 });
  const wide: string[] = [];
  for (const path of [...PAGES, `/sl/app/plots/${plot.data!.id}`, `/sl/app/shipments/${ship.data!.id}`]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    if (width > 390) wide.push(`${path}: ${width}px`);
  }
  expect(wide).toEqual([]);
});
