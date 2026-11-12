import { expect, test } from '@playwright/test';
import { crs, newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

const user = newUser();

test('a self-intersecting plot is repaired with one click', async ({ page }) => {
  await signUpWithOrganization(page, user, 'Žaga Popravki');
  const { client, organizationId } = await supabaseAs(user);
  const bowTie = [[14.5, 46.0], [14.502, 46.002], [14.502, 46.0], [14.5, 46.002], [14.5, 46.0]];
  const { data } = await client
    .from('plots')
    .insert({
      organization_id: organizationId, label: 'Metuljček', country: 'SI', validation_status: 'error',
      validation_issues: [{ code: 'POLYGON_SELF_INTERSECTION', severity: 'error', params: { lon: 14.501, lat: 46.001 } }],
      geom: { type: 'Polygon', crs, coordinates: [bowTie] } as unknown as string,
    })
    .select('id')
    .single();
  await page.goto(`/sl/app/plots/${data!.id}`);
  await expect(page.getByText(/seka samo sebe/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Popravi samodejno' }).click();
  await expect(page.getByRole('button', { name: 'Popravi samodejno' })).toHaveCount(0);
  const { data: after } = await client.from('plots').select('validation_status, validation_issues, geom').eq('id', data!.id).single();
  expect((after!.geom as unknown as { type: string }).type).toBe('MultiPolygon');
  expect(JSON.stringify(after!.validation_issues)).not.toContain('POLYGON_SELF_INTERSECTION');
});
