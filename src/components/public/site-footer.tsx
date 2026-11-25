import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonClass, cx } from "@/components/ui";
import { listPublicCategories } from "@/server/services/marketplace";
import { categoryName, container } from "./format";

async function loadCategories() {
  try {
    return await listPublicCategories();
  } catch {
    return [];
  }
}

const linkClass = "text-sm text-white/70 transition-colors hover:text-white";

export async function SiteFooter() {
  const categories = (await loadCategories()).slice(0, 8);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-white">
      <div className={cx(container, "border-b border-white/10 py-14 sm:py-16")}>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="display text-[28px] text-white sm:text-[40px]">Imate izposojevalnico?</p>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
              Vodite inventar, enote in rezervacije v RENTORA Business. Oprema, ki jo objavite, je samodejno vidna na tržnici. Prvih 14 dni je brezplačnih, kartica ni potrebna.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <Link href="/signup" className={buttonClass("amber", "lg")}>
              Začnite brezplačni preizkus
            </Link>
            <Link href="/pricing" className={cx(buttonClass("ghost", "lg"), "border border-white/25 text-white hover:bg-white/10")}>
              Oglejte si cenik
            </Link>
          </div>
        </div>
      </div>

      <div className={cx(container, "grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-12")}>
        <div className="lg:col-span-4">
          <Link href="/" aria-label="RENTORA, domov" className="inline-block rounded-xs">
            <Logo inverted />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            Tržnica za najem opreme in sistem za vodenje izposojevalnic. Narejeno v Sloveniji.
          </p>
        </div>

        <nav aria-label="Kategorije opreme" className="lg:col-span-3">
          <h2 className="text-sm font-semibold text-white">Oprema</h2>
          <ul className="mt-4 space-y-2.5">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link className={linkClass} href={`/equipment?category=${c.slug}`}>
                  {categoryName(c.name_i18n)}
                </Link>
              </li>
            ))}
            <li>
              <Link className={cx(linkClass, "text-white")} href="/equipment">
                Vsa oprema
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Za izposojevalnice" className="lg:col-span-3">
          <h2 className="text-sm font-semibold text-white">Za izposojevalnice</h2>
          <ul className="mt-4 space-y-2.5">
            <li><Link className={linkClass} href="/business">RENTORA Business</Link></li>
            <li><Link className={linkClass} href="/pricing">Cenik in provizija</Link></li>
            <li><Link className={linkClass} href="/signup">Registracija</Link></li>
            <li><Link className={linkClass} href="/login">Prijava</Link></li>
          </ul>
        </nav>

        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Pravno</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-white/50">
            {["Pogoji uporabe", "Zasebnost", "Piškotki"].map((l) => (
              <li key={l} className="flex flex-wrap items-center gap-2">
                <span>{l}</span>
                <span className="rounded-xs border border-white/15 px-1.5 text-[11px] text-white/60">v pripravi</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={cx(container, "flex flex-col gap-2 border-t border-white/10 py-6 text-[13px] text-white/50 sm:flex-row sm:justify-between")}>
        <p>© {year} RENTORA</p>
        <p>Pravna besedila bodo objavljena pred zagonom tržnice.</p>
      </div>
    </footer>
  );
}
