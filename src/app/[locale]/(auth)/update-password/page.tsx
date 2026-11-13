import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UpdatePasswordForm } from '@/components/auth/password-forms';
import { redirect } from '@/i18n/navigation';
import { getSessionUser } from '@/lib/auth/session';

export default async function UpdatePasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Reached through the e-mail link (the callback signs the user in) or from settings while signed in.
  if (!(await getSessionUser())) redirect({ href: '/forgot-password', locale });
  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t('updateTitle')}</h1>
      <UpdatePasswordForm />
    </>
  );
}
