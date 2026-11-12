import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@/components/auth/auth-form';
import { Link, redirect } from '@/i18n/navigation';
import { safeNext } from '@/lib/auth/redirect';
import { getSessionUser } from '@/lib/auth/session';
import { signUp } from '../actions';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> };

export default async function SignUpPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).next;
  const next = raw ? safeNext(raw) : undefined;
  if (await getSessionUser()) redirect({ href: next ?? '/app', locale });
  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t('signUpTitle')}</h1>
      <AuthForm mode="signUp" action={signUp} next={next} />
      <p className="text-muted-foreground text-sm">
        {t('haveAccount')}{' '}
        <Link href={next ? { pathname: '/login', query: { next } } : '/login'} className="text-primary font-medium underline-offset-4 hover:underline">
          {t('signInTitle')}
        </Link>
      </p>
    </>
  );
}
