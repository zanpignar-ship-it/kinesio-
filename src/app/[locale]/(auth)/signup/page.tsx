import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@/components/auth/auth-form';
import { Link, redirect } from '@/i18n/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { signUp } from '../actions';

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getSessionUser()) redirect({ href: '/app', locale });
  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t('signUpTitle')}</h1>
      <AuthForm mode="signUp" action={signUp} />
      <p className="text-muted-foreground text-sm">
        {t('haveAccount')}{' '}
        <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
          {t('signInTitle')}
        </Link>
      </p>
    </>
  );
}
