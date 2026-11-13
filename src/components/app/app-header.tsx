import { ChevronsUpDown, LogOut } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { LogoMark } from '@/components/brand/logo';
import { Link } from '@/i18n/navigation';
import { signOut } from '@/app/[locale]/(auth)/actions';
import { switchOrganization } from '@/app/[locale]/app/actions';
import type { Membership } from '@/lib/auth/session';
import { AppNav } from './app-nav';

type Props = { current: Membership; all: Membership[]; email: string | null };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

async function OrgSwitcher({ current, all }: Pick<Props, 'current' | 'all'>) {
  const t = await getTranslations();
  const locale = await getLocale();
  if (all.length <= 1) {
    return (
      <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-white/5 px-2.5 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-200/15 text-xs font-semibold text-emerald-100">
          {initials(current.organization.name)}
        </span>
        <span className="text-sidebar-foreground truncate text-sm font-medium">{current.organization.name}</span>
      </div>
    );
  }
  return (
    <form action={switchOrganization} className="flex flex-col gap-1.5">
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor="org" className="sr-only">
        {t('app.switchOrganization')}
      </label>
      <div className="relative">
        <select
          id="org"
          name="organizationId"
          defaultValue={current.organization.id}
          className="text-sidebar-foreground h-10 w-full appearance-none rounded-lg border border-white/10 !bg-white/5 py-0 pr-8 pl-2.5 text-sm font-medium shadow-none"
        >
          {all.map((m) => (
            <option key={m.organization.id} value={m.organization.id} className="text-foreground">
              {m.organization.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown className="text-sidebar-muted pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" aria-hidden />
      </div>
      <button type="submit" className="text-sidebar-muted hover:text-sidebar-foreground self-start text-xs underline-offset-4 hover:underline">
        {t('app.switchOrganization')}
      </button>
    </form>
  );
}

async function SignOut({ compact = false }: { compact?: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  return (
    <form action={signOut}>
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        className="text-sidebar-muted hover:text-sidebar-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-white/5"
        aria-label={compact ? t('auth.signOut') : undefined}
      >
        <LogOut className="size-4" aria-hidden />
        {compact ? null : t('auth.signOut')}
      </button>
    </form>
  );
}

/** App chrome: a dark green sidebar on large screens, a compact top bar with scrollable navigation on phones. */
export async function AppHeader({ current, all, email }: Props) {
  const t = await getTranslations();
  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 px-4 py-5 lg:flex">
        <Link href="/app" className="flex items-center gap-2.5 px-2 text-lg font-semibold tracking-wide text-white">
          <LogoMark className="size-8" variant="light" />
          {t('common.appName')}
        </Link>
        <OrgSwitcher current={current} all={all} />
        <div className="flex flex-col gap-2">
          <p className="text-sidebar-muted px-3 text-[11px] font-semibold tracking-wider uppercase">{t('app.menu')}</p>
          <AppNav variant="sidebar" />
        </div>
        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
          {email ? <p className="text-sidebar-muted truncate px-2 text-xs">{email}</p> : null}
          <SignOut />
        </div>
      </aside>
      <header className="bg-sidebar text-sidebar-foreground sticky top-0 z-30 lg:hidden">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <Link href="/app" className="flex items-center gap-2 font-semibold tracking-wide text-white">
            <LogoMark className="size-7" variant="light" />
            {t('common.appName')}
          </Link>
          <span className="text-sidebar-muted min-w-0 flex-1 truncate text-right text-sm">{current.organization.name}</span>
          <SignOut compact />
        </div>
        <div className="px-4">
          <AppNav variant="bar" />
        </div>
        {all.length > 1 ? (
          <details className="border-t border-white/10 px-4 py-2">
            <summary className="text-sidebar-muted cursor-pointer text-xs">{t('app.switchOrganization')}</summary>
            <div className="pt-2">
              <OrgSwitcher current={current} all={all} />
            </div>
          </details>
        ) : null}
      </header>
    </>
  );
}
