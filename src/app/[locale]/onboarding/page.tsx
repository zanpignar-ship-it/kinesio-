import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrganizationForm } from '@/components/app/organization-form';
import { requireUser } from '@/lib/auth/session';

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, '/onboarding');
  const t = await getTranslations('org');
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t('onboardingTitle')}</h1>
        <p className="text-muted-foreground">{t('onboardingIntro')}</p>
      </div>
      <OrganizationForm />
    </main>
  );
}
