import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { listUnits } from "@/server/services/inventory";
import { qrSvg } from "@/server/services/passport";
import { cx, PageHeader } from "@/components/ui";
import { Logo } from "@/components/logo";
import { UNIT_STATUSES, type UnitStatus } from "@/domain/unit";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "QR nalepke" };

const SIZES = {
  s: { label: "Majhna 38 × 25 mm", w: "38mm", h: "25mm", qr: "19mm", text: "text-[7pt]" },
  m: { label: "Srednja 50 × 30 mm", w: "50mm", h: "30mm", qr: "24mm", text: "text-[8pt]" },
  l: { label: "Velika 70 × 40 mm", w: "70mm", h: "40mm", qr: "32mm", text: "text-[10pt]" },
} as const;

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ listing?: string; unit?: string; status?: string; size?: string }> }) {
  const actor = await requireActor("inventory.read");
  const sp = await searchParams;
  const size = (sp.size && sp.size in SIZES ? sp.size : "m") as keyof typeof SIZES;
  const status = (UNIT_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as UnitStatus) : undefined;
  const all = await listUnits(actor, { status });
  const units = all.filter((u) => (!sp.listing || u.listing_id === sp.listing) && (!sp.unit || u.id === sp.unit)).slice(0, 300);
  const svgs = await Promise.all(units.map((u) => qrSvg(u.qr_token)));
  const s = SIZES[size];
  const qs = (k: string) => new URLSearchParams({ ...(sp.listing && { listing: sp.listing }), ...(sp.unit && { unit: sp.unit }), ...(status && { status }), size: k }).toString();
  return (
    <>
      <div className="no-print">
        <PageHeader title="QR nalepke" description={`${units.length} nalepk. Natisnite na samolepilne etikete; v nastavitvah tiskanja izberite velikost 100 % in brez robov.`}
          back={{ href: "/app/units", label: "Enote" }} actions={<PrintButton />} />
        <nav aria-label="Velikost nalepke" className="mb-6 flex flex-wrap gap-1">
          {Object.entries(SIZES).map(([k, v]) => (
            <Link key={k} href={`/app/units/labels?${qs(k)}`} aria-current={k === size ? "page" : undefined}
              className={cx("h-8 rounded-sm px-3 text-[13px] leading-8", k === size ? "bg-ink text-white" : "bg-surface ring-1 ring-line")}>{v.label}</Link>
          ))}
        </nav>
      </div>
      <div className="flex flex-wrap gap-[2mm] print:gap-[1mm]">
        {units.map((u, i) => (
          <div key={u.id} className="flex break-inside-avoid items-center gap-[2mm] overflow-hidden rounded-[1.5mm] border border-ink bg-white p-[1.5mm] text-ink" style={{ width: s.w, height: s.h }}>
            <div className="shrink-0 [&>svg]:h-full [&>svg]:w-full" style={{ width: s.qr, height: s.qr }} dangerouslySetInnerHTML={{ __html: svgs[i] }} />
            <div className={cx("flex min-w-0 flex-col justify-between self-stretch py-[0.5mm]", s.text)}>
              <Logo className="scale-[0.6] origin-left" />
              <span className="font-mono font-bold leading-tight break-all">{u.internal_code}</span>
              {size !== "s" && <span className="line-clamp-2 leading-tight">{u.listing_title}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
