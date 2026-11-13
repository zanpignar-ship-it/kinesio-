import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { AppHeader } from '@/components/app/app-header';
import { redirect } from '@/i18n/navigation';
import { homeFor } from '@/lib/auth/redirect';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';

export default async function AppLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app');
  const { current, all } = await getCurrentMembership(user.id);
  if (!current) redirect({ href: homeFor({ signedIn: true, orgCount: 0 }), locale });
  return (
    <div className="app-shell app-surface lg:pl-64">
      {current ? <AppHeader current={current} all={all} email={user.email} /> : null}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
