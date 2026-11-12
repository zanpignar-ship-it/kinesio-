import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrganizationForm } from '@/components/app/organization-form';
import { MembersPanel } from '@/components/members/members-panel';
import { DeleteAccount } from '@/components/settings/delete-account';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentMembership, requireUser } from '@/lib/auth/session';
import { updateOrganization } from './actions';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, '/app/settings');
  const { current } = await getCurrentMembership(user.id);
  if (!current) return null;
  const t = await getTranslations('settings');
  const o = current.organization;
  const isOwner = current.role === 'owner';
  const initial: Record<string, string> = {
    name: o.name,
    country: o.country,
    kind: o.kind,
    size: o.size,
    taxId: o.tax_id ?? '',
    registrationNo: o.registration_no ?? '',
    eori: o.eori ?? '',
    ...(o.was_under_eutr ? { wasUnderEutr: 'on' } : {}),
  };
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('organization')}</CardTitle>
          {!isOwner ? <CardDescription>{t('ownerOnlyHint')}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <OrganizationForm submit={updateOrganization} initial={initial} submitLabel={t('save')} disabled={!isOwner} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('members')}</CardTitle>
        </CardHeader>
        <CardContent>
          <MembersPanel organizationId={o.id} currentUserId={user.id} isOwner={isOwner} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('archiveTitle')}</CardTitle>
          <CardDescription>{t('archiveIntro')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <a href={`/${locale}/app/archive`} className={buttonVariants({ variant: 'outline' })} download>
              {t('archiveDownload')}
            </a>
            <Link href="/app/settings/audit" className={buttonVariants({ variant: 'ghost' })}>
              {t('auditLink')}
            </Link>
          </div>
        </CardContent>
      </Card>
      {user.email ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('deleteTitle')}</CardTitle>
            <CardDescription>{t('deleteIntro')}</CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccount email={user.email} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
