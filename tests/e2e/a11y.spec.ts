import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

const user = newUser();
const PAGES = ['/sl', '/sl/login', '/sl/signup', '/sl/terms', '/sl/app', '/sl/app/plots', '/sl/app/plots/new', '/sl/app/documents', '/sl/app/documents/new', '/sl/app/shipments', '/sl/app/shipments/new', '/sl/app/master-data/suppliers', '/sl/app/settings', '/sl/app/help'];

test('main pages have no serious accessibility violations', async ({ page }) => {
  test.setTimeout(180_000);
  await signUpWithOrganization(page, user, 'Žaga Dostopnost');
  const { client, organizationId } = await supabaseAs(user);
  await client.from('plots').insert({ organization_id: organizationId, label: 'Gozd A', country: 'SI', validation_status: 'warning', validation_issues: [], area_ha: 1, area_source: 'declared', geom: { type: 'Point', crs, coordinates: [14.512345, 46.051234] } as unknown as string });
  const problems: string[] = [];
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // The map canvas is a third-party widget; its contents are excluded.
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('.maplibregl-map').analyze();
    for (const v of r.violations.filter((x) => x.impact === 'critical' || x.impact === 'serious')) {
      problems.push(`${path} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    }
  }
  expect(problems).toEqual([]);
});
