import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth/session';

type Step = { h: string; p: string; href: string; link: string };
type Faq = { q: string; a: string };

/** Getting started and frequent questions; texts live in messages (help.*). */
export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, '/app/help');
  const t = await getTranslations('help');
  const steps = t.raw('steps') as Step[];
  const faq = t.raw('faq') as Faq[];
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('intro')}</p>
      </div>
      <ol className="flex flex-col gap-4" data-testid="help-steps">
        {steps.map((s, i) => (
          <li key={s.h} className="flex gap-4 rounded-xl border p-4">
            <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-semibold">{i + 1}</span>
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">{s.h}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.p}</p>
              <Link href={s.href} className="text-primary self-start text-sm font-medium underline-offset-4 hover:underline">
                {s.link} →
              </Link>
            </div>
          </li>
        ))}
      </ol>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('faqTitle')}</h2>
        {faq.map((f) => (
          <details key={f.q} className="rounded-lg border px-4 py-3">
            <summary className="cursor-pointer font-medium">{f.q}</summary>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{f.a}</p>
          </details>
        ))}
      </section>
      <p className="text-muted-foreground text-xs">{t('disclaimer')}</p>
    </div>
  );
}
