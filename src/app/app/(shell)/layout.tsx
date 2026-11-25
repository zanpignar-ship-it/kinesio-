import Link from "next/link";
import { requireActor, getSession } from "@/server/session";
import { BottomNav, SideNav, type NavItem } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icons";
import { t } from "@/i18n";
import { logoutAction, switchOrgAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const session = await getSession();
  const items: NavItem[] = [
    { href: "/app", label: t("nav.dashboard"), icon: "home" },
    { href: "/app/calendar", label: t("nav.calendar"), icon: "calendar" },
    { href: "/app/reservations", label: t("nav.reservations"), icon: "list" },
    { href: "/app/inventory", label: t("nav.inventory"), icon: "box" },
    { href: "/app/units", label: t("nav.units"), icon: "tag" },
    { href: "/app/customers", label: t("nav.customers"), icon: "users" },
    { href: "/app/scan", label: t("nav.scan"), icon: "scan" },
  ];
  const mobile: NavItem[] = [items[0], items[1], items[6], items[2], items[3]];
  const initials = actor.userName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col bg-ink px-3 py-5 lg:flex">
        <Link href="/app" className="mb-6 px-3"><Logo inverted /></Link>
        {session && session.memberships.length > 1 ? (
          <form action={switchOrgAction} className="mb-5 px-1">
            <label className="sr-only" htmlFor="org-switch">Podjetje</label>
            <select id="org-switch" name="orgId" defaultValue={actor.orgId} className="h-9 w-full rounded-sm border border-white/15 bg-white/5 px-2 text-sm text-white">
              {session.memberships.map((m) => <option key={m.id} value={m.id} className="text-ink">{m.name}</option>)}
            </select>
            <button className="mt-1 text-xs text-white/50 hover:text-white">Preklopi</button>
          </form>
        ) : (
          <p className="mb-5 truncate px-3 text-[13px] text-white/50">{actor.orgName}</p>
        )}
        <SideNav items={items} />
        <div className="mt-auto space-y-1">
          <SideNav items={[{ href: "/app/settings", label: t("nav.settings"), icon: "settings" }]} />
          <div className="flex items-center gap-3 border-t border-white/10 px-3 pt-4">
            <span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-white">{actor.userName}</p>
              <p className="text-xs text-white/50">{t(`role.${actor.role}`)}, paket {actor.plan.toUpperCase()}</p>
            </div>
            <form action={logoutAction}>
              <button title={t("nav.logout")} className="grid size-8 place-items-center rounded-sm text-white/50 hover:bg-white/10 hover:text-white">
                <Icon name="logout" className="size-4" /><span className="sr-only">{t("nav.logout")}</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
          <Link href="/app"><Logo /></Link>
          <details className="relative">
            <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full bg-sunken text-xs font-semibold">{initials}</summary>
            <div className="absolute right-0 mt-2 w-56 rounded-md border border-line bg-surface p-1.5 shadow-float">
              <p className="truncate px-2.5 py-1.5 text-xs text-steel">{actor.orgName}</p>
              <Link href="/app/units" className="block rounded-sm px-2.5 py-2 text-sm hover:bg-sunken">{t("nav.units")}</Link>
              <Link href="/app/customers" className="block rounded-sm px-2.5 py-2 text-sm hover:bg-sunken">{t("nav.customers")}</Link>
              <Link href="/app/settings" className="block rounded-sm px-2.5 py-2 text-sm hover:bg-sunken">{t("nav.settings")}</Link>
              <form action={logoutAction}><button className="w-full rounded-sm px-2.5 py-2 text-left text-sm hover:bg-sunken">{t("nav.logout")}</button></form>
            </div>
          </details>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">{children}</main>
      </div>
      <BottomNav items={mobile} />
    </div>
  );
}
