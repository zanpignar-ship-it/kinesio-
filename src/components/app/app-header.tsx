import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { signOut } from '@/app/[locale]/(auth)/actions';
import { switchOrganization } from '@/app/[locale]/app/actions';
import type { Membership } from '@/lib/auth/session';

type Props = { current: Membership; all: Membership[]; email: string | null };

export async function AppHeader({ current, all, email }: Props) {
  const t = await getTranslations();
  const locale = await getLocale();
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/app" className="text-primary font-semibold">
          {t('common.appName')}
        </Link>
        {all.length > 1 ? (
          <form action={switchOrganization} className="flex items-center gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label htmlFor="org" className="sr-only">
              {t('app.switchOrganization')}
            </label>
            <select id="org" name="organizationId" defaultValue={current.organization.id} className="border-input h-9 max-w-48 rounded-md border bg-transparent px-2 text-sm">
              {all.map((m) => (
                <option key={m.organization.id} value={m.organization.id}>
                  {m.organization.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              {t('app.switchOrganization')}
            </Button>
          </form>
        ) : (
          <span className="truncate text-sm font-medium">{current.organization.name}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {email ? <span className="text-muted-foreground hidden text-sm sm:inline">{email}</span> : null}
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="ghost" size="sm">
              {t('auth.signOut')}
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
