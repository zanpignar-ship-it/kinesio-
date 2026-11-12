import { expect, test } from '@playwright/test';
import { newUser, signUpWithOrganization, supabaseAs } from './helpers/auth';

const user = newUser();

test('a standard-risk country needs a risk assessment before the shipment is ready', async ({ page }) => {
  await signUpWithOrganization(page, user, 'Uvoznik Tveganje');
  const { client, organizationId } = await supabaseAs(user);
  const { data } = await client.from('shipments').insert({ organization_id: organizationId, internal_ref: 'UA-1', mode: 'submit_dds', activity: 'import', country_of_production: 'UA' }).select('id').single();

  await page.goto(`/sl/app/shipments/${data!.id}`);
  await expect(page.getByTestId('risk-level')).toHaveText('UA: standardno tveganje');
  await expect(page.getByTestId('check-riskAssessmentMissing')).toBeVisible();

  await page.getByLabel('Ocena tveganja (merila iz 10. člena, ugotovitve)').fill('Preverjena dovoljenja za posek in lastništvo; satelitski posnetki brez krčenja po 31. 12. 2020.');
  await page.getByLabel('Ugotavljam, da je tveganje zanemarljivo.').check();
  await page.getByRole('button', { name: 'Shrani oceno tveganja' }).click();
  await expect(page.getByText('Ocena tveganja je shranjena.')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('check-riskAssessmentMissing')).toHaveCount(0);
  await expect(page.getByTestId('check-riskNotNegligible')).toHaveCount(0);
  await expect(page.getByLabel('Ugotavljam, da je tveganje zanemarljivo.')).toBeChecked();
});
