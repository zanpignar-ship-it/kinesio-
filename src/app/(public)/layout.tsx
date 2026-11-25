import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#vsebina"
        className="sr-only z-50 rounded-sm bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Preskoči na vsebino
      </a>
      <SiteHeader />
      <main id="vsebina" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
