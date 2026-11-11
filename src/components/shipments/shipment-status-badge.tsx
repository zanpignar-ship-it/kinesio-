import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const STYLE = {
  draft: 'bg-muted text-muted-foreground',
  ready: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  submitted: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
} as const;

export function ShipmentStatusBadge({ status }: { status: keyof typeof STYLE }) {
  const t = useTranslations('ship.status');
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STYLE[status])}>{t(status)}</span>;
}
