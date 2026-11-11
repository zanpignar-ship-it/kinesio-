import { useTranslations } from 'next-intl';
import type { Issue } from '@/lib/geo/types';
import { cn } from '@/lib/utils';

/** Validation issues of a plot in the user's language (info messages hidden). */
export function IssueList({ issues }: { issues: Issue[] }) {
  const t = useTranslations('geo.issues');
  const tp = useTranslations('plots');
  const shown = issues.filter((i) => i.severity !== 'info');
  if (shown.length === 0) return <p className="text-sm text-emerald-800 dark:text-emerald-300">{tp('noIssues')}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {shown.map((issue, i) => (
        <li
          key={`${issue.code}-${i}`}
          className={cn(
            'rounded-md border-l-4 px-3 py-2 text-sm',
            issue.severity === 'error' ? 'border-red-600 bg-red-50 dark:bg-red-950/40' : 'border-amber-500 bg-amber-50 dark:bg-amber-950/40',
          )}
        >
          {t(issue.code, issue.params ?? {})}
        </li>
      ))}
    </ul>
  );
}
