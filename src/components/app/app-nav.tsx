'use client';

import { BookOpen, FileText, LayoutDashboard, LifeBuoy, MapPinned, Settings, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/app', key: 'dashboard', icon: LayoutDashboard },
  { href: '/app/plots', key: 'plots', icon: MapPinned },
  { href: '/app/documents', key: 'documents', icon: FileText },
  { href: '/app/shipments', key: 'shipments', icon: Truck },
  { href: '/app/master-data', key: 'masterData', icon: BookOpen },
  { href: '/app/settings', key: 'settings', icon: Settings },
  { href: '/app/help', key: 'help', icon: LifeBuoy },
] as const;

function isActive(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Main navigation: a vertical list in the sidebar, a scrollable row of pills on small screens. */
export function AppNav({ variant }: { variant: 'sidebar' | 'bar' }) {
  const t = useTranslations('app.nav');
  const pathname = usePathname();
  if (variant === 'bar') {
    return (
      <nav aria-label={t('label')} className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-sidebar-active text-white' : 'text-sidebar-muted hover:text-sidebar-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(key)}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav aria-label={t('label')} className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-sidebar-active text-white' : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground',
            )}
          >
            {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-emerald-300" aria-hidden /> : null}
            <Icon className={cn('size-[18px]', active ? 'text-emerald-200' : 'opacity-80')} aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
