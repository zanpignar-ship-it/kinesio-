import { useTranslations } from 'next-intl';
import type { DocumentExpiry } from '@/lib/documents/expiry';
import { cn } from '@/lib/utils';

const STYLE: Record<DocumentExpiry, string> = {
  none: 'bg-muted text-muted-foreground',
  valid: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  expiring: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  expired: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
};

export function ExpiryBadge({ expiry }: { expiry: DocumentExpiry }) {
  const t = useTranslations('documents.expiry');
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STYLE[expiry])}>{t(expiry)}</span>;
}
