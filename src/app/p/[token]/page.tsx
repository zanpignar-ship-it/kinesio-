import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { publicUnitCard } from "@/server/services/passport";
import { getSession } from "@/server/session";
import { getUnitByQr } from "@/server/services/inventory";
import { isRole } from "@/domain/permissions";
import { Logo } from "@/components/logo";
import { EquipmentGlyph } from "@/components/equipment-glyph";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Oprema", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * QR entry point. Members of the owning organization are sent to the full passport;
 * everyone else sees only the equipment name and the provider's public contact.
 */
export default async function QrPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const card = await publicUnitCard(token);
  if (!card) notFound();
  const session = await getSession();
  const membership = session?.memberships.find((m) => m.id === card.org_id);
  if (session && membership && isRole(membership.role)) {
    const found = await getUnitByQr({ orgId: membership.id, userId: session.user.id, role: membership.role }, token);
    if (found) redirect(`/app/units/${found.unit.id}?scan=1`);
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
      <Link href="/" aria-label="RENTORA"><Logo /></Link>
      <div className="mt-10 overflow-hidden rounded-md border border-line bg-surface">
        <div className="grid place-items-center bg-sunken p-8 text-ink-2"><EquipmentGlyph className="w-48" /></div>
        <div className="p-5">
          <h1 className="text-xl font-semibold">{card.listing_title}</h1>
          <p className="mt-1 text-sm text-steel">Ta oprema je last izposojevalnice {card.provider_name}.</p>
          {card.provider_phone && <p className="mt-4 text-sm">Kontakt: <a className="font-medium underline underline-offset-2" href={`tel:${card.provider_phone.replace(/\s/g, "")}`}>{card.provider_phone}</a></p>}
          <div className="mt-6 flex flex-wrap gap-2">
            {card.is_published && <LinkButton href={`/equipment/${card.provider_slug}/${card.listing_slug}`}>Najemi to opremo</LinkButton>}
            <LinkButton href={`/login?next=/app/scan`} variant="secondary">Prijava za sodelavce</LinkButton>
          </div>
        </div>
      </div>
    </main>
  );
}
