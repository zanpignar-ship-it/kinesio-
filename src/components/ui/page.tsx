import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** Page title row: optional back link, title with badges, actions on the right. */
export function PageHeader({
  back,
  title,
  badges,
  actions,
  description,
}: {
  back?: { href: string; label: string };
  title: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {back ? (
        <Link href={back.href} className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-sm transition-colors">
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words">{title}</h1>
        {badges}
        {actions ? <div className="ml-auto flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="text-muted-foreground max-w-3xl text-sm">{description}</p> : null}
    </div>
  );
}

/** Friendly empty list: icon, message, hint and an optional action. */
export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-xl">
        <Icon className="size-6" aria-hidden />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        {hint ? <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Labelled facts in a card. Empty values are skipped. */
export function Facts({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!shown.length) return null;
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border p-5 sm:grid-cols-2', className)}>
      {shown.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{k}</dt>
          <dd className="mt-0.5 font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Filter pill used above lists. */
export function chipClass(active: boolean) {
  return cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
    active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground',
  );
}
