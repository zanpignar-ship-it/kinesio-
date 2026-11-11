'use server';

import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { ORG_COOKIE } from '@/lib/auth/pick-organization';
import { getMemberships, getSessionUser } from '@/lib/auth/session';

export async function switchOrganization(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'sl');
  const orgId = String(formData.get('organizationId') ?? '');
  const user = await getSessionUser();
  if (user && (await getMemberships(user.id)).some((m) => m.organization.id === orgId)) {
    (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  redirect({ href: '/app', locale });
}
