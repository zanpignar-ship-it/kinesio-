"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";
import { Icon, type IconName } from "./icons";

export type NavItem = { href: string; label: string; icon: IconName };

function isActive(path: string, href: string) {
  return href === "/app" ? path === "/app" : path === href || path.startsWith(href + "/");
}

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Glavna navigacija" className="flex flex-col gap-0.5">
      {items.map((i) => {
        const active = isActive(path, i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
            className={cx("group flex h-9 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-[var(--dur-fast)]",
              active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white")}>
            <Icon name={i.icon} className={cx("size-4", active ? "text-amber" : "")} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Glavna navigacija" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {items.map((i) => {
          const active = isActive(path, i.href);
          const scan = i.icon === "scan";
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? "page" : undefined}
                className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-ink" : "text-steel")}>
                <span className={cx("grid place-items-center rounded-sm", scan ? "size-9 bg-amber text-ink" : "size-6")}>
                  <Icon name={i.icon} className="size-5" />
                </span>
                {!scan && i.label}
                {scan && <span className="sr-only">{i.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
