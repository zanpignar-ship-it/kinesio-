import { ArrowRight, CheckCircle2, Circle, FileCheck2, Gauge, Map as MapIcon, Package, Send, ShieldCheck, Trees, Warehouse } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

type Feature = { h: string; p: string };

const FEATURE_ICONS = [MapIcon, ShieldCheck, FileCheck2, Send, Gauge, Package];
const AUDIENCE_ICONS = [Trees, Warehouse];

/** Illustrative product preview: a shipment checklist next to a plot on the map (no real data). */
function ProductPreview({ labels }: { labels: { title: string; items: string[]; ready: string } }) {
  return (
    <div aria-hidden className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-200/50 via-lime-100/40 to-transparent blur-2xl dark:from-emerald-900/40" />
      <div className="bg-card overflow-hidden rounded-2xl border shadow-xl shadow-emerald-950/10">
        <div className="flex items-center gap-1.5 border-b px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-300" />
          <span className="size-2.5 rounded-full bg-amber-300" />
          <span className="size-2.5 rounded-full bg-emerald-300" />
          <span className="text-muted-foreground ml-3 text-xs font-medium">{labels.title}</span>
        </div>
        <div className="grid gap-0 sm:grid-cols-[1.1fr_1fr]">
          <div className="relative min-h-44 bg-[oklch(0.42_0.06_150)]">
            <svg viewBox="0 0 200 160" className="absolute inset-0 size-full">
              <defs>
                <pattern id="trees" width="14" height="14" patternUnits="userSpaceOnUse">
                  <circle cx="7" cy="7" r="4.5" fill="oklch(0.36 0.07 150)" />
                </pattern>
              </defs>
              <rect width="200" height="160" fill="url(#trees)" />
              <path d="M0 120 Q60 100 110 130 T200 110" stroke="oklch(0.8 0.05 90)" strokeWidth="5" fill="none" opacity=".7" />
              <polygon points="52,34 128,26 150,74 112,104 60,92" fill="oklch(0.85 0.15 150 / 0.28)" stroke="oklch(0.92 0.14 150)" strokeWidth="2.5" strokeLinejoin="round" />
              {[
                [52, 34],
                [128, 26],
                [150, 74],
                [112, 104],
                [60, 92],
              ].map(([x, y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="white" />
              ))}
            </svg>
          </div>
          <ul className="flex flex-col gap-2.5 p-5 text-sm">
            {labels.items.map((item, i) => (
              <li key={item} className="flex items-center gap-2.5">
                {i < labels.items.length - 1 ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="text-muted-foreground size-4 shrink-0" />
                )}
                <span className={i < labels.items.length - 1 ? '' : 'text-muted-foreground'}>{item}</span>
              </li>
            ))}
            <li className="mt-1">
              <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900">{labels.ready}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

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
    <>
      <header className="sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="text-primary flex items-center gap-2 text-lg font-semibold tracking-wide">
            <LogoMark className="size-8" />
            {common('appName')}
          </span>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{auth('signInTitle')}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">{t('cta')}</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex flex-col gap-20 pb-20 sm:gap-28">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(50% 60% at 85% 0%, oklch(0.92 0.06 150 / 0.7), transparent 70%), radial-gradient(40% 50% at 0% 30%, oklch(0.95 0.05 100 / 0.6), transparent 70%)',
            }}
          />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr]">
            <div className="flex flex-col gap-6">
              <span className="bg-card text-secondary-foreground inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-medium shadow-xs">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {t('badge')}
              </span>
              <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem]">{t('title')}</h1>
              <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">{t('subtitle')}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-7 text-base">
                  <Link href="/signup">
                    {t('cta')}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
                  <Link href="/login">{auth('signInTitle')}</Link>
                </Button>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p className="bg-card flex flex-col rounded-xl border p-3">
                  <strong className="font-semibold">{t('deadlineLarge')}</strong>
                </p>
                <p className="bg-card flex flex-col rounded-xl border p-3">
                  <strong className="font-semibold">{t('deadlineSmall')}</strong>
                </p>
              </div>
            </div>
            <ProductPreview labels={{ title: t('preview.title'), items: t.raw('preview.items') as string[], ready: t('preview.ready') }} />
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6" aria-labelledby="features">
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="text-primary text-sm font-semibold tracking-wider uppercase">{common('appName')}</p>
            <h2 id="features" className="text-3xl font-semibold tracking-tight">
              {t('featuresTitle')}
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length] ?? MapIcon;
              return (
                <li key={f.h} className="bg-card flex flex-col gap-3 rounded-2xl border p-6 transition-shadow hover:shadow-lg hover:shadow-emerald-950/5">
                  <span className="bg-accent text-accent-foreground flex size-11 items-center justify-center rounded-xl">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight">{f.h}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.p}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="bg-sidebar relative overflow-hidden py-16 text-white sm:py-20" aria-labelledby="steps">
          <svg aria-hidden viewBox="0 0 400 400" className="absolute -right-24 -bottom-32 w-[32rem] text-white/[0.05]">
            {Array.from({ length: 10 }, (_, i) => (
              <circle key={i} cx="200" cy="200" r={24 + i * 20} fill="none" stroke="currentColor" strokeWidth="2" />
            ))}
          </svg>
          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
            <h2 id="steps" className="text-3xl font-semibold tracking-tight">
              {t('stepsTitle')}
            </h2>
            <ol className="grid gap-6 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                  <span className="flex size-10 items-center justify-center rounded-full bg-emerald-300 text-lg font-semibold text-emerald-950">{i + 1}</span>
                  <p className="leading-relaxed text-emerald-50/90">{s}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6" aria-labelledby="audiences">
          <h2 id="audiences" className="text-3xl font-semibold tracking-tight">
            {t('audiencesTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {audiences.map((a, i) => {
              const Icon = AUDIENCE_ICONS[i % AUDIENCE_ICONS.length] ?? Trees;
              return (
                <div key={a.h} className="bg-card flex gap-4 rounded-2xl border p-6">
                  <span className="bg-secondary text-secondary-foreground flex size-12 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-lg font-semibold tracking-tight">{a.h}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{a.p}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="bg-primary text-primary-foreground relative flex flex-col items-start gap-5 overflow-hidden rounded-3xl p-8 sm:p-12">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: 'radial-gradient(60% 100% at 100% 0%, oklch(0.6 0.12 150 / 0.6), transparent 70%)' }}
            />
            <h2 className="relative text-3xl font-semibold tracking-tight">{t('ctaTitle')}</h2>
            <p className="relative max-w-xl text-lg opacity-90">{t('ctaText')}</p>
            <Button asChild size="lg" variant="secondary" className="relative h-12 px-7 text-base">
              <Link href="/signup">
                {t('cta')}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </>
  );
}
