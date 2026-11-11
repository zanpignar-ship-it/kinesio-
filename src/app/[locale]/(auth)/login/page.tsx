import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@/components/auth/auth-form';
import { Link, redirect } from '@/i18n/navigation';
import { safeNext } from '@/lib/auth/redirect';
import { getSessionUser } from '@/lib/auth/session';
import { signIn } from '../actions';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const next = safeNext((await searchParams).next);
  if (await getSessionUser()) redirect({ href: next, locale });
  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t('signInTitle')}</h1>
      <AuthForm mode="signIn" action={signIn} next={next} />
      <p className="text-muted-foreground text-sm">
        {t('noAccount')}{' '}
        <Link href="/signup" className="text-primary font-medium underline-offset-4 hover:underline">
          {t('signUpTitle')}
        </Link>
      </p>
    </>
  );
}
