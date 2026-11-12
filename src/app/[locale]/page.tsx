import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

type Feature = { h: string; p: string };

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const common = await getTranslations('common');
  const auth = await getTranslations('auth');
  const features = t.raw('features') as Feature[];
  const steps = t.raw('steps') as string[];
  const audiences = t.raw('audiences') as Feature[];
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-4 py-10 sm:py-16">
      <section className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="text-primary text-lg font-bold tracking-wide">{common('appName')}</span>
        </div>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">{t('title')}</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">{t('subtitle')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">{t('cta')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">{auth('signInTitle')}</Link>
          </Button>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <strong>{t('deadlineLarge')}</strong>
          <span>{t('deadlineSmall')}</span>
        </div>
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="features">
        <h2 id="features" className="text-2xl font-bold tracking-tight">
          {t('featuresTitle')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <li key={f.h} className="flex flex-col gap-1 rounded-xl border p-5">
              <h3 className="font-semibold">{f.h}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.p}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="steps">
        <h2 id="steps" className="text-2xl font-bold tracking-tight">
          {t('stepsTitle')}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 rounded-xl border p-5">
              <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-semibold">{i + 1}</span>
              <p className="text-sm leading-relaxed">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label={t('audiencesTitle')}>
        {audiences.map((a) => (
          <div key={a.h} className="flex flex-col gap-1 rounded-xl border p-5">
            <h3 className="font-semibold">{a.h}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{a.p}</p>
          </div>
        ))}
      </section>

      <section className="bg-primary text-primary-foreground flex flex-col items-start gap-4 rounded-2xl p-8">
        <h2 className="text-2xl font-bold tracking-tight">{t('ctaTitle')}</h2>
        <p className="opacity-90">{t('ctaText')}</p>
        <Button asChild size="lg" variant="secondary">
          <Link href="/signup">{t('cta')}</Link>
        </Button>
      </section>
    </main>
  );
}
