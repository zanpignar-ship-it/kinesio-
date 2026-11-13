import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ForgotPasswordForm } from '@/components/auth/password-forms';
import { Link } from '@/i18n/navigation';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ expired?: string }> };

export default async function ForgotPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const expired = (await searchParams).expired === '1';
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t('forgotTitle')}</h1>
      {expired ? (
        <p role="alert" className="text-destructive text-sm">
          {t('errors.resetExpired')}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{t('forgotIntro')}</p>
      )}
      <ForgotPasswordForm />
      <Link href="/login" className="text-primary text-sm font-medium underline-offset-4 hover:underline">
        {t('backToLogin')}
      </Link>
    </>
  );
}
