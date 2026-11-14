import { Archive, Building2, Download, History, KeyRound, Send, UserRound, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrganizationForm } from '@/components/app/organization-form';
import { MembersPanel } from '@/components/members/members-panel';
import { DeleteAccount } from '@/components/settings/delete-account';
import { TracesSettings } from '@/components/traces/traces-settings';
import { DEFAULT_CLIENT_ID, tracesSettings } from '@/lib/traces/service';
import { SAMPLE } from '@/lib/demo/sample';
import { createServerSupabase } from '@/lib/supabase/server';
import { deleteSampleData } from '../actions';
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
  const traces = isOwner ? await tracesSettings(o.id) : null;
  const supabase = await createServerSupabase();
  const { count: sampleCount } = await supabase.from('shipments').select('id', { count: 'exact', head: true }).eq('organization_id', o.id).eq('internal_ref', SAMPLE.shipment.internalRef);
  const initial: Record<string, string> = {
    name: o.name,
    country: o.country,
    kind: o.kind,
    size: o.size,
    taxId: o.tax_id ?? '',
    registrationNo: o.registration_no ?? '',
    address: o.address ?? '',
    eori: o.eori ?? '',
    ...(o.was_under_eutr ? { wasUnderEutr: 'on' } : {}),
  };
  const sections = [
    { id: 'organization', label: t('organization'), icon: Building2 },
    { id: 'members', label: t('members'), icon: Users },
    ...(isOwner ? [{ id: 'traces', label: t('tracesTitle'), icon: Send }] : []),
    { id: 'data', label: t('archiveTitle'), icon: Archive },
    { id: 'account', label: t('accountTitle'), icon: UserRound },
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />
      <div className="grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={t('title')} className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:px-0">
          {sections.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`} className="text-muted-foreground hover:bg-card hover:text-foreground flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors">
              <Icon className="size-4" aria-hidden />
              {label}
            </a>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-6 [&>*]:scroll-mt-24">
          <Card id="organization">
            <CardHeader>
              <CardTitle>{t('organization')}</CardTitle>
              {!isOwner ? <CardDescription>{t('ownerOnlyHint')}</CardDescription> : null}
            </CardHeader>
            <CardContent>
              <OrganizationForm submit={updateOrganization} initial={initial} submitLabel={t('save')} disabled={!isOwner} />
            </CardContent>
          </Card>
          <Card id="members">
            <CardHeader>
              <CardTitle>{t('members')}</CardTitle>
            </CardHeader>
            <CardContent>
              <MembersPanel organizationId={o.id} currentUserId={user.id} isOwner={isOwner} />
            </CardContent>
          </Card>
          {isOwner ? (
            <Card id="traces">
              <CardHeader>
                <CardTitle>{t('tracesTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <TracesSettings settings={traces} defaults={DEFAULT_CLIENT_ID} />
              </CardContent>
            </Card>
          ) : null}
          <Card id="data">
            <CardHeader>
              <CardTitle>{t('archiveTitle')}</CardTitle>
              <CardDescription>{t('archiveIntro')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <a href={`/${locale}/app/archive`} className={buttonVariants({ variant: 'outline' })} download>
                  <Download aria-hidden />
                  {t('archiveDownload')}
                </a>
                <Link href="/app/settings/audit" className={buttonVariants({ variant: 'ghost' })}>
                  <History aria-hidden />
                  {t('auditLink')}
                </Link>
              </div>
              {sampleCount ? (
                <form action={deleteSampleData} className="flex flex-wrap items-center gap-3 border-t pt-4">
                  <input type="hidden" name="locale" value={locale} />
                  <span className="text-sm font-medium">{t('sampleTitle')}</span>
                  <button type="submit" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    {t('sampleDelete')}
                  </button>
                </form>
              ) : null}
            </CardContent>
          </Card>
          <Card id="account">
            <CardHeader>
              <CardTitle>{t('accountTitle')}</CardTitle>
              {user.email ? <CardDescription>{user.email}</CardDescription> : null}
            </CardHeader>
            <CardContent>
              <Link href="/update-password" className={buttonVariants({ variant: 'outline' })}>
                <KeyRound aria-hidden />
                {t('changePassword')}
              </Link>
            </CardContent>
          </Card>
          {user.email ? (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive">{t('deleteTitle')}</CardTitle>
                <CardDescription>{t('deleteIntro')}</CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteAccount email={user.email} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
