import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AcceptInvitation } from '@/components/members/accept-invitation';
import { buttonVariants } from '@/components/ui/button';
import { Link, redirect } from '@/i18n/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { invitationInfo } from '@/lib/members/queries';

type Props = { params: Promise<{ locale: string; token: string }> };

export default async function InvitePage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('members');
  const next = `/invite/${encodeURIComponent(token)}`;
  const user = await getSessionUser();
  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">{t('invitedTitle')}</h1>
        <p className="text-muted-foreground">{t('signInFirst')}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={{ pathname: '/signup', query: { next } }} className={buttonVariants()}>
            {t('createAccount')}
          </Link>
          <Link href={{ pathname: '/login', query: { next } }} className={buttonVariants({ variant: 'outline' })}>
            {t('signIn')}
          </Link>
        </div>
      </main>
    );
  }
  const info = await invitationInfo(token);
  if (info?.already_member) redirect({ href: '/app', locale });
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
      {!info ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">{t('invalidTitle')}</h1>
          <p className="text-muted-foreground">{t('invalidHint')}</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">{t('joinTitle', { organization: info.organization })}</h1>
          <p className="text-muted-foreground">{t('joinIntro', { role: t(`roles.${info.role}`) })}</p>
          {info.email_matches ? (
            <AcceptInvitation token={token} />
          ) : (
            <p role="alert" className="text-destructive text-sm">
              {t('wrongEmail', { email: info.email, current: user.email ?? '' })}
            </p>
          )}
        </>
      )}
    </main>
  );
}
