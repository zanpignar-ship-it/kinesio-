"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/logo";
import { buttonClass, cx } from "@/components/ui";
import { container } from "./format";

const links = [
  { href: "/equipment", label: "Oprema" },
  { href: "/business", label: "Za izposojevalnice" },
  { href: "/pricing", label: "Cenik" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);

  // Client-side navigation keeps the layout mounted: close the menu on route change.
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-line bg-paper">
      <div className={cx(container, "flex h-full items-center justify-between gap-6")}>
        <Link href="/" aria-label="RENTORA, domov" className="shrink-0 rounded-xs">
          <Logo />
        </Link>

        <nav aria-label="Glavna navigacija" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className="rounded-sm px-3 py-2 text-sm text-steel transition-colors hover:text-ink aria-[current=page]:text-ink aria-[current=page]:font-medium"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-sm px-3 py-2 text-sm text-ink-2 hover:text-ink">
            Prijava
          </Link>
          <Link href="/signup" className={buttonClass("primary", "sm")}>
            Registracija
          </Link>
        </div>

        <details ref={menu} className="group relative md:hidden">
          <summary
            className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden"
            aria-label="Odpri meni"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden>
              <path className="group-open:hidden" d="M3 6h14M3 10h14M3 14h14" />
              <path className="hidden group-open:block" d="M5 5l10 10M15 5 5 15" />
            </svg>
            Meni
          </summary>
          <nav
            aria-label="Mobilna navigacija"
            className="fixed inset-x-0 top-16 border-b border-line bg-paper px-4 pt-2 pb-6 shadow-float"
          >
            <ul className="divide-y divide-line">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={isActive(l.href) ? "page" : undefined}
                    className="flex h-12 items-center text-[15px] text-ink aria-[current=page]:font-semibold"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/login" className="flex h-12 items-center text-[15px] text-ink">
                  Prijava
                </Link>
              </li>
            </ul>
            <Link href="/signup" className={cx(buttonClass("primary", "lg"), "mt-4 w-full")}>
              Registracija
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
