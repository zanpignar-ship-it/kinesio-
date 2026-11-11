import { getFormatter, getTranslations } from 'next-intl/server';

type Section = { h: string; p: string };

/** Static legal text from messages (legal.termsSections / legal.privacySections). */
export async function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const t = await getTranslations('legal');
  const format = await getFormatter();
  const sections = t.raw(kind === 'terms' ? 'termsSections' : 'privacySections') as Section[];
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t(kind)}</h1>
      <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        {t('draft')}
      </p>
      {sections.map((s) => (
        <section key={s.h} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{s.h}</h2>
          <p className="text-muted-foreground leading-relaxed">{s.p}</p>
        </section>
      ))}
      <p className="text-muted-foreground text-sm">{t('updated', { date: format.dateTime(new Date('2026-11-12T00:00:00Z'), { dateStyle: 'long', timeZone: 'UTC' }) })}</p>
    </main>
  );
}
