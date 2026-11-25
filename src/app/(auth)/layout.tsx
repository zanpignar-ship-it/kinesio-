import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" aria-label="RENTORA domov"><Logo inverted /></Link>
        <div className="max-w-md">
          <p className="display text-5xl">Vsaka enota.<br />Vsak termin.<br />Na enem mestu.</p>
          <p className="mt-6 text-[15px] leading-relaxed text-white/70">
            RENTORA Business vodi inventar, rezervacije in stranke vaše izposojevalnice. Razpoložljivost se samodejno prikaže na tržnici.
          </p>
        </div>
        <div className="hazard h-2 w-24 rounded-full opacity-90" aria-hidden />
      </aside>
      <main className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block lg:hidden" aria-label="RENTORA domov"><Logo /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
