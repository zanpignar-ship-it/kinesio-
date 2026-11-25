"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { cx } from "@/components/ui";
import { prefersReducedMotion } from "@/components/motion";
import type { ActionState } from "@/server/action";

export type TLUnit = { id: string; code: string; listingId: string; listing: string; status: string };
export type TLAlloc = { id: string; unitId: string; kind: string; start: number; end: number; blockedUntil: number; reservationId: string | null; number: string | null; status: string | null; customer: string | null; source: string | null; note: string | null };

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const SNAP = HOUR;
const MOVABLE = new Set(["draft", "quotation", "awaiting_confirmation", "confirmed", "awaiting_pickup"]);

const tone = (a: TLAlloc) =>
  a.kind !== "rental" ? "bg-amber-soft text-ink ring-1 ring-amber/70 [background-image:repeating-linear-gradient(-45deg,transparent_0_6px,rgb(242_167_27/0.25)_6px_12px)]"
  : a.status === "active" || a.status === "awaiting_return" ? "bg-ink text-white"
  : a.status === "overdue" ? "bg-bad text-white"
  : a.status === "awaiting_confirmation" || a.status === "quotation" || a.status === "draft" ? "bg-surface text-ink ring-1 ring-dashed ring-ink/40 border border-dashed border-ink/40"
  : a.status === "completed" || a.status === "inspection" ? "bg-sunken text-steel"
  : "bg-info text-white";

export function Timeline({ units, allocations, from, days, now, moveAction }: {
  units: TLUnit[]; allocations: TLAlloc[]; from: number; days: number; now: number;
  moveAction: (id: string, s: string, e: string) => Promise<ActionState>;
}) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [allocs, setAllocs] = useState(allocations);
  const [drag, setDrag] = useState<{ reservationId: string; dx: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const to = from + days * DAY;
  const dayW = days <= 7 ? 140 : days <= 14 ? 84 : 44;
  const width = days * dayW;
  const x = (t: number) => Math.round(((t - from) / (to - from)) * width * 2) / 2;

  useLayoutEffect(() => setAllocs(allocations), [allocations]);
  useLayoutEffect(() => {
    if (!root.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => gsap.from("[data-bar]", { scaleX: 0, transformOrigin: "0% 50%", duration: 0.4, ease: "power2.out", stagger: 0.01, clearProps: "transform" }), root);
    return () => ctx.revert();
  }, [from, days]);

  const groups = useMemo(() => {
    const m = new Map<string, { listing: string; listingId: string; units: TLUnit[] }>();
    for (const u of units) {
      if (!m.has(u.listingId)) m.set(u.listingId, { listing: u.listing, listingId: u.listingId, units: [] });
      m.get(u.listingId)!.units.push(u);
    }
    return [...m.values()];
  }, [units]);

  function startDrag(e: React.PointerEvent, a: TLAlloc) {
    if (!a.reservationId || !a.status || !MOVABLE.has(a.status)) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      setDrag({ reservationId: a.reservationId!, dx });
    };
    const onUp = async (ev: PointerEvent) => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      const dx = ev.clientX - startX;
      setDrag(null);
      if (!moved) { router.push(`/app/reservations/${a.reservationId}`); return; }
      const shift = Math.round(((dx / width) * (to - from)) / SNAP) * SNAP;
      if (!shift) return;
      await commitShift(a.reservationId!, shift);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  async function commitShift(reservationId: string, shift: number) {
    const before = allocs;
    const target = allocs.find((x) => x.reservationId === reservationId)!;
    setAllocs(allocs.map((x) => x.reservationId === reservationId ? { ...x, start: x.start + shift, end: x.end + shift, blockedUntil: x.blockedUntil + shift } : x));
    const res = await moveAction(reservationId, new Date(target.start + shift).toISOString(), new Date(target.end + shift).toISOString());
    if (res?.error) {
      setAllocs(before);
      setMessage({ tone: "bad", text: res.error });
      if (!prefersReducedMotion()) gsap.fromTo(`[data-res="${reservationId}"]`, { x: -6 }, { x: 0, duration: 0.4, ease: "elastic.out(1.2, 0.3)" });
    } else {
      setMessage({ tone: "ok", text: `${target.number} je prestavljena. Cena je preračunana.` });
      router.refresh();
    }
  }

  function onKey(e: React.KeyboardEvent, a: TLAlloc) {
    if (!a.reservationId || !a.status || !MOVABLE.has(a.status)) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      commitShift(a.reservationId, (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? HOUR : DAY));
    }
  }

  const dayLabels = Array.from({ length: days }, (_, i) => new Date(from + i * DAY));
  const fmtDay = new Intl.DateTimeFormat("sl-SI", { weekday: "short", day: "numeric", timeZone: "Europe/Ljubljana" });
  const fmtTime = new Intl.DateTimeFormat("sl-SI", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Ljubljana" });

  return (
    <div ref={root}>
      <div aria-live="polite" className="min-h-6">
        {message && <p className={cx("mb-3 rounded-sm px-3 py-2 text-sm", message.tone === "ok" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>{message.text}</p>}
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <div style={{ width: width + 200 }} className="relative select-none">
          <div className="sticky top-0 z-20 flex border-b border-line bg-surface">
            <div className="sticky left-0 z-10 w-[200px] shrink-0 border-r border-line bg-surface px-3 py-2 text-xs text-steel">Enota</div>
            {dayLabels.map((d) => {
              const wd = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "Europe/Ljubljana" }).format(d);
              return <div key={d.getTime()} style={{ width: dayW }} className={cx("shrink-0 border-r border-line px-2 py-2 text-xs tabular", (wd === "Sat" || wd === "Sun") ? "bg-paper text-mute" : "text-steel")}>{fmtDay.format(d)}</div>;
            })}
          </div>
          {groups.map((g) => (
            <div key={g.listingId}>
              <div className="sticky left-0 flex h-8 items-center border-b border-line bg-paper px-3 text-xs font-medium text-ink-2" style={{ width: width + 200 }}>
                <Link href={`/app/inventory/${g.listingId}`} className="sticky left-3 hover:underline">{g.listing}</Link>
              </div>
              {g.units.map((u) => (
                <div key={u.id} className="flex h-12 border-b border-line last:border-b-0">
                  <Link href={`/app/units/${u.id}`} className="sticky left-0 z-10 flex w-[200px] shrink-0 items-center border-r border-line bg-surface px-3 font-mono text-xs font-semibold hover:bg-paper">{u.code}</Link>
                  <div className="relative" style={{ width }}>
                    {dayLabels.map((d, i) => (
                      <Link key={i} href={`/app/reservations/new?listing=${u.listingId}&start=${new Date(d.getTime() + 8 * HOUR).toISOString()}`} aria-label={`Nova rezervacija ${u.code}, ${fmtDay.format(d)}`} tabIndex={-1}
                        className="absolute inset-y-0 border-r border-line/60 hover:bg-info-soft/40" style={{ left: i * dayW, width: dayW }} />
                    ))}
                    {now > from && now < to && <div aria-hidden className="pointer-events-none absolute inset-y-0 z-10 w-px bg-bad" style={{ left: x(now) }} />}
                    {allocs.filter((a) => a.unitId === u.id).map((a) => {
                      const dx = drag && drag.reservationId === a.reservationId ? drag.dx : 0;
                      const left = Math.max(0, x(a.start)) + dx;
                      const right = Math.min(width, x(a.end)) + dx;
                      const bufRight = Math.min(width, x(a.blockedUntil)) + dx;
                      const movable = !!a.status && MOVABLE.has(a.status);
                      const label = a.kind === "rental" ? `${a.number?.split("-").pop()} ${a.customer ?? ""}` : a.kind === "maintenance" ? `Servis${a.note ? `: ${a.note}` : ""}` : "Blokirano";
                      return (
                        <div key={a.id}>
                          {bufRight > right && <div aria-hidden className="absolute top-2 bottom-2 rounded-r-xs bg-line/70" style={{ left: right, width: bufRight - right }} title="Čas med najemi" />}
                          <div data-bar data-res={a.reservationId ?? a.id} role="button" tabIndex={0}
                            aria-label={`${label}, ${fmtTime.format(a.start)} do ${fmtTime.format(a.end)}${movable ? ". Puščici levo in desno premakneta za dan, s Shift za uro." : ""}`}
                            title={`${label}\n${fmtTime.format(a.start)} – ${fmtTime.format(a.end)}`}
                            onPointerDown={(e) => startDrag(e, a)} onKeyDown={(e) => onKey(e, a)}
                            onClick={(e) => { if (!a.reservationId || movable) return; e.preventDefault(); router.push(`/app/reservations/${a.reservationId}`); }}
                            className={cx("absolute top-2 bottom-2 z-[5] flex items-center overflow-hidden rounded-xs px-2 text-[11px] font-medium whitespace-nowrap shadow-raise", tone(a),
                              movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", dx !== 0 && "z-30 shadow-float")}
                            style={{ left, width: Math.max(6, right - left), touchAction: movable ? "none" : undefined }}>
                            <span className="truncate">{label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
