import Link from "next/link";
import type { Metadata } from "next";
import { requireActor } from "@/server/session";
import { getDashboard } from "@/server/services/dashboard";
import { onboardingStatus } from "@/server/services/organizations";
import { AssetTag, Badge, cx, fmtDateTime, LinkButton, Money, Panel, ReservationBadge, UnitBadge } from "@/components/ui";
import { BarChart, EnterSequence } from "@/components/motion";
import { Icon } from "@/components/icons";
import { formatMoney } from "@/domain/money";
import { t } from "@/i18n";
import type { ReservationStatus } from "@/domain/reservation";
import type { UnitStatus } from "@/domain/unit";

export const metadata: Metadata = { title: "Pregled" };

const ACTIONS: Record<string, string> = {
  "reservation.created": "ustvaril rezervacijo",
  "reservation.status_changed": "spremenil stanje rezervacije",
  "reservation.rescheduled": "prestavil rezervacijo",
  "listing.created": "dodal artikel",
  "listing.updated": "uredil artikel",
  "units.created": "dodal enote",
  "customer.created": "dodal stranko",
  "customer.updated": "uredil stranko",
  "organization.created": "ustvaril izposojevalnico",
  "organization.updated": "uredil podatke podjetja",
  "allocation.maintenance_created": "načrtoval servis",
  "allocation.block_created": "blokiral termin",
  "allocation.reassigned": "zamenjal enoto",
};

function entityHref(type: string, id: string | null) {
  if (!id) return null;
  return type === "reservation" ? `/app/reservations/${id}` : type === "customer" ? `/app/customers/${id}` : type === "listing" ? `/app/inventory/${id}` : type === "unit" ? `/app/units/${id}` : null;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const [d, onboarding] = await Promise.all([getDashboard(actor), onboardingStatus(actor)]);
  const steps = [
    { done: onboarding.inventory, label: "Dodajte prvi artikel opreme", href: "/app/inventory/new" },
    { done: onboarding.units, label: "Vnesite fizične enote z inventarnimi številkami", href: "/app/inventory" },
    { done: onboarding.customer, label: "Dodajte stranko", href: "/app/customers/new" },
    { done: onboarding.reservation, label: "Ustvarite prvo rezervacijo", href: "/app/reservations/new" },
    { done: onboarding.profile, label: "Dopolnite davčne podatke podjetja", href: "/app/settings" },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  const totalUnits = d.units.reduce((s, u) => s + u.count, 0);
  const monthDelta = d.revenue.prev_month ? Math.round(((d.revenue.month - d.revenue.prev_month) / d.revenue.prev_month) * 100) : null;
  const mpShare = d.revenue.month ? Math.round((d.revenue.marketplace / d.revenue.month) * 100) : 0;
  const today = new Intl.DateTimeFormat("sl-SI", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Ljubljana" }).format(new Date());
  const kpis = [
    { label: "Prevzemi danes", value: d.pickups.length, href: "#danes", tone: "" },
    { label: "Vračila danes", value: d.returns.length, href: "#danes", tone: "" },
    { label: "V najemu", value: d.counts.active, href: "/app/reservations?scope=active", tone: "" },
    { label: "Zamude", value: d.overdue.length, href: "/app/reservations?scope=active", tone: d.overdue.length ? "alert" : "" },
  ];

  return (
    <EnterSequence>
      <div data-enter className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-steel first-letter:uppercase">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {sp.welcome ? `Dobrodošli v RENTORA, ${actor.userName.split(" ")[0]}` : actor.orgName}
          </h1>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/app/reservations/new"><Icon name="plus" className="size-4" />Nova rezervacija</LinkButton>
          <LinkButton href="/app/scan" variant="secondary" className="lg:hidden"><Icon name="scan" className="size-4" />Skeniraj</LinkButton>
        </div>
      </div>

      {sp.denied && <p data-enter role="alert" className="mb-6 rounded-sm border border-bad/25 bg-bad-soft px-3 py-2.5 text-sm text-bad">{t("auth.forbidden")}</p>}

      {remaining > 0 && (
        <section data-enter aria-labelledby="ob" className="mb-8 rounded-md border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="ob" className="text-[15px] font-semibold">Začetna nastavitev</h2>
            <span className="text-sm text-steel tabular">{steps.length - remaining} / {steps.length}</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-sunken"><div className="h-full bg-ink" style={{ width: `${((steps.length - remaining) / steps.length) * 100}%` }} /></div>
          <ol className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link href={s.href} className={cx("flex h-full items-start gap-2.5 rounded-sm p-2 text-sm hover:bg-sunken", s.done && "text-mute line-through decoration-line-strong")}>
                  <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] tabular", s.done ? "border-ok bg-ok text-white" : "border-line-strong text-steel")}>
                    {s.done ? <Icon name="check" className="size-3" /> : i + 1}
                  </span>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div data-enter className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="group relative bg-surface p-4 transition-colors hover:bg-paper sm:p-5">
            {k.tone === "alert" && <span aria-hidden className="hazard absolute inset-x-0 top-0 h-1" />}
            <span className="text-[13px] text-steel">{k.label}</span>
            <span className={cx("mt-2 block text-3xl font-semibold tabular", k.tone === "alert" && "text-bad")}>{k.value}</span>
            <Icon name="chevronRight" className="absolute right-4 bottom-5 size-4 text-mute opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 [&>*]:min-w-0 xl:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-6">
          <div data-enter id="danes">
            <Panel title="Danes" action={<Link href="/app/calendar" className="text-[13px] text-steel hover:text-ink">Odpri koledar</Link>} padded={false}>
              {d.overdue.length > 0 && (
                <ul className="border-b border-line bg-bad-soft/50">
                  {d.overdue.map((r) => (
                    <li key={r.id}>
                      <Link href={`/app/reservations/${r.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-bad-soft">
                        <Icon name="alert" className="size-4 shrink-0 text-bad" />
                        <span className="font-medium">{r.number}</span>
                        <span className="min-w-0 flex-1 truncate text-steel">{r.customer}, rok vračila {fmtDateTime(r.ends_at)}</span>
                        <Badge tone="bad">{t("rs.overdue")}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {d.pickups.length + d.returns.length === 0 ? (
                <p className="px-4 py-8 text-sm text-steel">Danes ni načrtovanih prevzemov ali vračil.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {[...d.pickups.map((r) => ({ ...r, kind: "Prevzem", at: r.starts_at })), ...d.returns.map((r) => ({ ...r, kind: "Vračilo", at: r.ends_at }))]
                    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                    .map((r) => (
                      <li key={r.kind + r.id}>
                        <Link href={`/app/reservations/${r.id}`} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-paper">
                          <span className="text-sm font-semibold tabular">{new Intl.DateTimeFormat("sl-SI", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Ljubljana" }).format(new Date(r.at))}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{r.kind}: {r.customer}</span>
                            <span className="block truncate text-xs text-steel">{r.number}, {r.items}</span>
                          </span>
                          <ReservationBadge status={r.status as ReservationStatus} />
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>
          </div>

          <div data-enter>
            <Panel title="Rezervirana vrednost" action={<span className="text-xs text-steel">po datumu začetka, brez preklicanih</span>}>
              <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
                <div>
                  <p className="text-[13px] text-steel">Ta mesec</p>
                  <p className="text-3xl font-semibold tabular"><Money cents={d.revenue.month} /></p>
                  {monthDelta !== null && (
                    <p className={cx("mt-1 inline-flex items-center gap-1 text-xs", monthDelta >= 0 ? "text-ok" : "text-bad")}>
                      <Icon name={monthDelta >= 0 ? "arrowUp" : "arrowDown"} className="size-3" />
                      {Math.abs(monthDelta)} % glede na enako obdobje prejšnjega meseca
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[13px] text-steel">Danes</p>
                  <p className="text-xl font-semibold tabular"><Money cents={d.revenue.today} /></p>
                </div>
                <div className="min-w-48 flex-1">
                  <p className="mb-1.5 flex justify-between text-[13px] text-steel"><span>Tržnica {mpShare} %</span><span>Neposredno {100 - mpShare} %</span></p>
                  <div className="flex h-2 overflow-hidden rounded-full bg-sunken">
                    <div className="bg-amber" style={{ width: `${mpShare}%` }} />
                    <div className="bg-ink" style={{ width: `${d.revenue.month ? 100 - mpShare : 0}%` }} />
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <BarChart label="Rezervirana vrednost zadnjih 14 dni"
                  data={d.weekly.map((w) => ({ key: w.day, label: new Intl.DateTimeFormat("sl-SI", { day: "numeric", month: "numeric" }).format(new Date(w.day)), value: w.booked_cents, display: formatMoney(w.booked_cents) }))} />
              </div>
              <p className="mt-3 text-xs text-mute">Plačila in računi bodo prikazani, ko bo vklopljeno spletno plačevanje. To ni prejeti denar.</p>
            </Panel>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div data-enter>
            <Panel title="Oprema" action={<Link href="/app/units" className="text-[13px] text-steel hover:text-ink">Vse enote</Link>}>
              {totalUnits === 0 ? (
                <p className="text-sm text-steel">Ko dodate enote, tukaj vidite njihovo stanje in izkoriščenost.</p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between">
                    <p className="text-[13px] text-steel">Izkoriščenost, zadnjih 30 dni</p>
                    <p className="text-xl font-semibold tabular">{d.utilization == null ? "—" : `${Math.round(d.utilization * 100)} %`}</p>
                  </div>
                  <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label="Enote po stanju">
                    {d.units.map((u) => (
                      <div key={u.status} title={`${t(`us.${u.status as UnitStatus}`)}: ${u.count}`} style={{ width: `${(u.count / totalUnits) * 100}%` }}
                        className={cx(u.status === "available" ? "bg-ok" : u.status === "rented" ? "bg-ink" : u.status === "maintenance" ? "bg-amber" : u.status === "damaged" || u.status === "overdue" ? "bg-bad" : "bg-info")} />
                    ))}
                  </div>
                  <ul className="mt-4 grid grid-cols-2 gap-2">
                    {d.units.sort((a, b) => b.count - a.count).map((u) => (
                      <li key={u.status}>
                        <Link href={`/app/units?status=${u.status}`} className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-sunken">
                          <UnitBadge status={u.status as UnitStatus} />
                          <span className="font-medium tabular">{u.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>

          {d.maintenance.length > 0 && (
            <div data-enter>
              <Panel title="Potrebuje pozornost" padded={false}>
                <ul className="divide-y divide-line">
                  {d.maintenance.map((u) => (
                    <li key={u.id}>
                      <Link href={`/app/units/${u.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                        <AssetTag code={u.internal_code} />
                        <span className="min-w-0 flex-1 truncate text-sm">{u.listing_title}</span>
                        <UnitBadge status={u.status as UnitStatus} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}

          <div data-enter>
            <Panel title="Zadnje aktivnosti" padded={false}>
              {d.activity.length === 0 ? <p className="p-4 text-sm text-steel">Še ni aktivnosti.</p> : (
                <ol className="divide-y divide-line">
                  {d.activity.map((a, i) => {
                    const href = entityHref(a.entity_type, a.entity_id);
                    const body = (
                      <>
                        <span className="text-sm"><span className="font-medium">{a.actor ?? "Sistem"}</span> {ACTIONS[a.action] ?? a.action}
                          {typeof a.data?.number === "string" && <span className="text-steel"> {a.data.number}</span>}
                          {typeof a.data?.to === "string" && <span className="text-steel"> v »{t(`rs.${a.data.to as ReservationStatus}`)}«</span>}
                        </span>
                        <span className="block text-xs text-mute">{fmtDateTime(a.created_at)}</span>
                      </>
                    );
                    return <li key={i}>{href ? <Link href={href} className="block px-4 py-2.5 hover:bg-paper">{body}</Link> : <div className="px-4 py-2.5">{body}</div>}</li>;
                  })}
                </ol>
              )}
            </Panel>
          </div>
          <p data-enter className="text-xs text-mute">Varščine v teku: <span className="tabular">{formatMoney(d.counts.deposits_cents)}</span> (evidenčno). Čaka potrditev: {d.counts.awaiting_confirmation}.</p>
        </div>
      </div>
    </EnterSequence>
  );
}
