import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { PlotStatus } from '@/lib/geo/types';

const STYLE: Record<PlotStatus, string> = {
  valid: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  error: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
};
const ICON: Record<PlotStatus, string> = { valid: '✓', warning: '!', error: '✕' };

export function StatusBadge({ status }: { status: PlotStatus }) {
  const t = useTranslations('plots.statusOne');
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', STYLE[status])}>
      <span aria-hidden>{ICON[status]}</span>
      {t(status)}
    </span>
  );
}
