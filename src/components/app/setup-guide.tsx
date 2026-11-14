import { ArrowRight, Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SetupStep } from '@/lib/dashboard/setup';
import { cn } from '@/lib/utils';

/** "Getting started" card with progress; hidden by the caller once every step is done. */
export async function SetupGuide({ steps }: { steps: SetupStep[] }) {
  const t = await getTranslations('app.setup');
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done)?.key;
  return (
    <section className="flex flex-col gap-5 rounded-xl border p-6" data-testid="setup-guide" aria-labelledby="setup-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="setup-title" className="text-lg font-semibold tracking-tight">
            {t('title')}
          </h2>
          <p className="text-muted-foreground text-sm">{t('intro')}</p>
        </div>
        <p className="text-muted-foreground text-sm font-medium tabular-nums">{t('progress', { done, total: steps.length })}</p>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={t('title')}>
        <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={cn(
                'group flex h-full flex-col gap-2 rounded-lg border p-4 transition-colors',
                s.done ? 'bg-muted/50' : s.key === next ? 'border-primary bg-accent/50 hover:bg-accent' : 'hover:bg-muted',
              )}
            >
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                  s.done ? 'bg-primary text-primary-foreground' : 'border-2',
                )}
                aria-hidden
              >
                {s.done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn('font-medium', s.done && 'text-muted-foreground line-through decoration-1')}>{t(`steps.${s.key}.title`)}</span>
              <span className="text-muted-foreground text-xs leading-relaxed">{t(`steps.${s.key}.hint`)}</span>
              {s.done ? (
                <span className="sr-only">{t('done')}</span>
              ) : (
                <span className="text-primary mt-auto flex items-center gap-1 pt-1 text-sm font-medium">
                  {t('start')}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
