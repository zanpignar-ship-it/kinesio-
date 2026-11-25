import { z } from "zod";
import { withTenant, isExclusionViolation, type Tx } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { assertCan, ctx, type Actor } from "./actor";
import { transitionUnit } from "./inventory";
import { billableDays, quote, applyDiscount } from "@/domain/pricing";
import { reservationMachine, releasesAllocations, RESERVATION_SOURCES, type ReservationStatus } from "@/domain/reservation";
import type { UnitStatus } from "@/domain/unit";

const MAX_RENTAL_MS = 1000 * 60 * 60 * 24 * 730;

const periodSchema = z
  .object({ startsAt: z.coerce.date(), endsAt: z.coerce.date() })
  .refine((p) => p.endsAt.getTime() > p.startsAt.getTime(), { message: "reservation.endBeforeStart", path: ["endsAt"] })
  .refine((p) => p.endsAt.getTime() - p.startsAt.getTime() <= MAX_RENTAL_MS, { message: "reservation.tooLong", path: ["endsAt"] });

export const createReservationSchema = z
  .object({
    customerId: z.string().uuid(),
    source: z.enum(RESERVATION_SOURCES).default("direct"),
    status: z.enum(["draft", "quotation", "awaiting_confirmation", "confirmed"]).default("confirmed"),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    notes: z.string().trim().max(4000).optional().nullable(),
    items: z.array(z.object({ listingId: z.string().uuid(), quantity: z.number().int().min(1).max(500) })).min(1).max(50),
  })
  .superRefine((v, c) => {
    const r = periodSchema.safeParse(v);
    if (!r.success) for (const i of r.error.issues) c.addIssue({ code: "custom", message: i.message, path: i.path });
    const ids = v.items.map((i) => i.listingId);
    if (new Set(ids).size !== ids.length) c.addIssue({ code: "custom", message: "reservation.duplicateItem", path: ["items"] });
  });

type ListingForBooking = {
  id: string; title: string; price_day_cents: number; price_week_cents: number | null; price_month_cents: number | null;
  deposit_cents: number; buffer_minutes: number;
};

const BOOKABLE_UNIT_STATUSES: UnitStatus[] = ["available", "reserved", "awaiting_pickup", "rented", "awaiting_return", "overdue", "inspection", "maintenance"];

/**
 * Locks the listing's bookable units and returns those free for the period.
 * Row locks serialize concurrent bookings of the same listing; the exclusion
 * constraint on allocations remains the final guarantee.
 */
async function freeUnits(tx: Tx, listing: ListingForBooking, start: Date, end: Date, excludeReservationId?: string) {
  const blockedEnd = new Date(end.getTime() + listing.buffer_minutes * 60_000);
  await tx.query("select id from units where listing_id = $1 and status = any($2::unit_status[]) order by id for update", [listing.id, BOOKABLE_UNIT_STATUSES]);
  return tx.query<{ id: string; internal_code: string }>(
    `select u.id, u.internal_code from units u
      where u.listing_id = $1 and u.status = any($2::unit_status[])
        and not exists (
          select 1 from allocations a
           where a.unit_id = u.id and a.active and a.blocked && tstzrange($3, $4)
             and ($5::uuid is null or a.reservation_id is distinct from $5))
      order by (u.status = 'available') desc, u.internal_code`,
    [listing.id, BOOKABLE_UNIT_STATUSES, start, blockedEnd, excludeReservationId ?? null],
  );
}

export async function checkAvailability(actor: Actor, listingId: string, startsAt: Date, endsAt: Date) {
  assertCan(actor, "reservations.read");
  const p = periodSchema.parse({ startsAt, endsAt });
  return withTenant(ctx(actor), async (tx) => {
    const listing = await tx.maybeOne<ListingForBooking>("select * from listings where id = $1 and org_id = $2", [listingId, actor.orgId]);
    if (!listing) throw new DomainError("common.notFound");
    const free = await freeUnits(tx, listing, p.startsAt, p.endsAt);
    const days = billableDays(p.startsAt, p.endsAt);
    return {
      available: free.length,
      quote: quote({ dayCents: listing.price_day_cents, weekCents: listing.price_week_cents, monthCents: listing.price_month_cents }, days),
    };
  });
}

async function nextNumber(tx: Tx, orgId: string, prefix: string) {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const { value } = await tx.one<{ value: string }>(
    `insert into org_counters (org_id, key, value) values ($1, $2, 1)
     on conflict (org_id, key) do update set value = org_counters.value + 1 returning value`,
    [orgId, key],
  );
  return `${prefix}-${year}-${String(value).padStart(5, "0")}`;
}

export async function createReservation(actor: Actor, input: z.input<typeof createReservationSchema>) {
  assertCan(actor, "reservations.write");
  const d = createReservationSchema.parse(input);
  try {
    return await withTenant(ctx(actor), async (tx) => {
      const customer = await tx.maybeOne<{ id: string; discount_percent: string }>("select id, discount_percent from customers where id = $1 and org_id = $2", [d.customerId, actor.orgId]);
      if (!customer) throw new DomainError("reservation.customerNotFound");

      const days = billableDays(d.startsAt, d.endsAt);
      const plan: { listing: ListingForBooking; quantity: number; unitIds: string[]; unitPrice: number; basis: string }[] = [];
      // Lock listings in a deterministic order to avoid deadlocks between multi-item bookings.
      const sorted = [...d.items].sort((a, b) => a.listingId.localeCompare(b.listingId));
      for (const item of sorted) {
        const listing = await tx.maybeOne<ListingForBooking>("select * from listings where id = $1 and org_id = $2", [item.listingId, actor.orgId]);
        if (!listing) throw new DomainError("common.notFound");
        const free = await freeUnits(tx, listing, d.startsAt, d.endsAt);
        if (free.length < item.quantity) {
          throw new DomainError("reservation.unavailable", undefined, { listing: listing.title, requested: item.quantity, available: free.length });
        }
        const q = quote({ dayCents: listing.price_day_cents, weekCents: listing.price_week_cents, monthCents: listing.price_month_cents }, days);
        const basis = [q.breakdown.months && `${q.breakdown.months}×M`, q.breakdown.weeks && `${q.breakdown.weeks}×T`, q.breakdown.days && `${q.breakdown.days}×D`].filter(Boolean).join(" + ");
        plan.push({ listing, quantity: item.quantity, unitIds: free.slice(0, item.quantity).map((u) => u.id), unitPrice: q.totalCents, basis });
      }

      const subtotal = plan.reduce((s, p) => s + p.unitPrice * p.quantity, 0);
      const { discountCents, totalCents } = applyDiscount(subtotal, Number(customer.discount_percent));
      const deposit = plan.reduce((s, p) => s + p.listing.deposit_cents * p.quantity, 0);
      const number = await nextNumber(tx, actor.orgId, "R");

      const res = await tx.one<{ id: string; number: string }>(
        `insert into reservations (org_id, number, customer_id, status, source, starts_at, ends_at, notes, subtotal_cents, discount_cents, total_cents, deposit_cents, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id, number`,
        [actor.orgId, number, d.customerId, d.status, d.source, d.startsAt, d.endsAt, d.notes ?? null, subtotal, discountCents, totalCents, deposit, actor.userId],
      );
      for (const p of plan) {
        const item = await tx.one<{ id: string }>(
          `insert into reservation_items (org_id, reservation_id, listing_id, quantity, unit_price_cents, line_total_cents, pricing_basis)
           values ($1,$2,$3,$4,$5,$6,$7) returning id`,
          [actor.orgId, res.id, p.listing.id, p.quantity, p.unitPrice, p.unitPrice * p.quantity, p.basis],
        );
        const blockedEnd = new Date(d.endsAt.getTime() + p.listing.buffer_minutes * 60_000);
        for (const unitId of p.unitIds) {
          await tx.query(
            `insert into allocations (org_id, unit_id, reservation_id, item_id, kind, period, blocked, created_by)
             values ($1,$2,$3,$4,'rental', tstzrange($5,$6), tstzrange($5,$7), $8)`,
            [actor.orgId, unitId, res.id, item.id, d.startsAt, d.endsAt, blockedEnd, actor.userId],
          );
        }
      }
      await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "reservation.created", entityType: "reservation", entityId: res.id, data: { number, source: d.source, status: d.status } });
      return res;
    });
  } catch (e) {
    if (isExclusionViolation(e)) throw new DomainError("reservation.conflict");
    throw e;
  }
}

/** Unit status follows reservation progress where it is physically meaningful. */
const UNIT_EFFECT: Partial<Record<ReservationStatus, UnitStatus>> = {
  active: "rented",
  awaiting_return: "awaiting_return",
  overdue: "overdue",
  inspection: "inspection",
};

export async function transitionReservation(actor: Actor, reservationId: string, to: ReservationStatus, reason?: string) {
  assertCan(actor, to === "cancelled" ? "reservations.cancel" : "reservations.write");
  return withTenant(ctx(actor), async (tx) => {
    const r = await tx.maybeOne<{ id: string; status: ReservationStatus; number: string }>(
      "select id, status, number from reservations where id = $1 and org_id = $2 for update",
      [reservationId, actor.orgId],
    );
    if (!r) throw new DomainError("common.notFound");
    reservationMachine.assert(r.status, to);
    await tx.query("update reservations set status = $2::reservation_status, cancelled_at = case when $2::text = 'cancelled' then now() else cancelled_at end where id = $1", [r.id, to]);
    const units = await tx.query<{ unit_id: string; status: UnitStatus }>(
      "select a.unit_id, u.status from allocations a join units u on u.id = a.unit_id where a.reservation_id = $1 and a.active",
      [r.id],
    );
    if (releasesAllocations(to)) {
      await tx.query("update allocations set active = false where reservation_id = $1", [r.id]);
    }
    const effect = UNIT_EFFECT[to];
    if (effect) for (const u of units) await transitionUnit(tx, actor, u.unit_id, effect, `${r.number}`);
    if (to === "completed") {
      // Release the remaining buffer / period from now on so the unit becomes bookable immediately.
      await tx.query(
        `update allocations set period = tstzrange(lower(period), greatest(lower(period) + interval '1 minute', least(upper(period), now()))),
                                blocked = tstzrange(lower(blocked), greatest(lower(period) + interval '1 minute', least(upper(blocked), now())))
          where reservation_id = $1 and active and upper(blocked) > now()`,
        [r.id],
      );
      for (const u of units) if (u.status === "inspection") await transitionUnit(tx, actor, u.unit_id, "available", `${r.number} completed`);
    }
    await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "reservation.status_changed", entityType: "reservation", entityId: r.id, data: { from: r.status, to, reason: reason ?? null } });
  });
}

/** Moves a reservation in time (calendar drag & drop). Validated server-side. */
export async function rescheduleReservation(actor: Actor, reservationId: string, startsAt: Date, endsAt: Date) {
  assertCan(actor, "reservations.write");
  const p = periodSchema.parse({ startsAt, endsAt });
  try {
    return await withTenant(ctx(actor), async (tx) => {
      const r = await tx.maybeOne<{ id: string; status: ReservationStatus; customer_id: string }>(
        "select id, status, customer_id from reservations where id = $1 and org_id = $2 for update", [reservationId, actor.orgId]);
      if (!r) throw new DomainError("common.notFound");
      if (!["draft", "quotation", "awaiting_confirmation", "confirmed", "awaiting_pickup", "active"].includes(r.status)) throw new DomainError("reservation.notReschedulable");
      if (r.status === "active" && p.startsAt.getTime() !== (await tx.one<{ s: Date }>("select starts_at as s from reservations where id=$1", [r.id])).s.getTime()) {
        throw new DomainError("reservation.activeStartLocked");
      }
      const days = billableDays(p.startsAt, p.endsAt);
      const items = await tx.query<ListingForBooking & { item_id: string; quantity: number }>(
        "select l.*, ri.id as item_id, ri.quantity from reservation_items ri join listings l on l.id = ri.listing_id where ri.reservation_id = $1", [r.id]);
      let subtotal = 0;
      for (const it of items) {
        await tx.query("select id from units where listing_id = $1 order by id for update", [it.id]);
        const q = quote({ dayCents: it.price_day_cents, weekCents: it.price_week_cents, monthCents: it.price_month_cents }, days);
        subtotal += q.totalCents * it.quantity;
        await tx.query("update reservation_items set unit_price_cents = $2, line_total_cents = $3 where id = $1", [it.item_id, q.totalCents, q.totalCents * it.quantity]);
        const blockedEnd = new Date(p.endsAt.getTime() + it.buffer_minutes * 60_000);
        await tx.query("update allocations set period = tstzrange($2,$3), blocked = tstzrange($2,$4) where item_id = $1 and active", [it.item_id, p.startsAt, p.endsAt, blockedEnd]);
      }
      const c = await tx.one<{ discount_percent: string }>("select discount_percent from customers where id = $1", [r.customer_id]);
      const { discountCents, totalCents } = applyDiscount(subtotal, Number(c.discount_percent));
      await tx.query("update reservations set starts_at=$2, ends_at=$3, subtotal_cents=$4, discount_cents=$5, total_cents=$6 where id=$1", [r.id, p.startsAt, p.endsAt, subtotal, discountCents, totalCents]);
      await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "reservation.rescheduled", entityType: "reservation", entityId: r.id, data: { startsAt: p.startsAt, endsAt: p.endsAt } });
    });
  } catch (e) {
    if (isExclusionViolation(e)) throw new DomainError("reservation.conflict");
    throw e;
  }
}

/** Reassigns one allocation to another physical unit of the same listing. */
export async function reassignAllocation(actor: Actor, allocationId: string, unitId: string) {
  assertCan(actor, "reservations.write");
  try {
    return await withTenant(ctx(actor), async (tx) => {
      const a = await tx.maybeOne<{ id: string; listing_id: string; reservation_id: string }>(
        `select a.id, u.listing_id, a.reservation_id from allocations a join units u on u.id = a.unit_id
          where a.id = $1 and a.org_id = $2 and a.active and a.kind = 'rental' for update of a`, [allocationId, actor.orgId]);
      if (!a) throw new DomainError("common.notFound");
      const target = await tx.maybeOne<{ listing_id: string; status: UnitStatus }>("select listing_id, status from units where id = $1 and org_id = $2 for update", [unitId, actor.orgId]);
      if (!target || target.listing_id !== a.listing_id) throw new DomainError("reservation.wrongUnit");
      if (!BOOKABLE_UNIT_STATUSES.includes(target.status)) throw new DomainError("reservation.unitNotBookable");
      await tx.query("update allocations set unit_id = $2 where id = $1", [a.id, unitId]);
      await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "allocation.reassigned", entityType: "reservation", entityId: a.reservation_id, data: { allocationId, unitId } });
    });
  } catch (e) {
    if (isExclusionViolation(e)) throw new DomainError("reservation.conflict");
    throw e;
  }
}

export const blockSchema = z.object({
  unitId: z.string().uuid(),
  kind: z.enum(["maintenance", "block"]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function createBlock(actor: Actor, input: z.input<typeof blockSchema>) {
  const d = blockSchema.parse(input);
  assertCan(actor, d.kind === "maintenance" ? "maintenance.write" : "inventory.write");
  periodSchema.parse(d);
  try {
    return await withTenant(ctx(actor), async (tx) => {
      const unit = await tx.maybeOne("select id from units where id = $1 and org_id = $2 for update", [d.unitId, actor.orgId]);
      if (!unit) throw new DomainError("common.notFound");
      const a = await tx.one<{ id: string }>(
        `insert into allocations (org_id, unit_id, kind, period, blocked, note, created_by)
         values ($1,$2,$3,tstzrange($4,$5),tstzrange($4,$5),$6,$7) returning id`,
        [actor.orgId, d.unitId, d.kind, d.startsAt, d.endsAt, d.note ?? null, actor.userId],
      );
      await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: `allocation.${d.kind}_created`, entityType: "unit", entityId: d.unitId, data: { allocationId: a.id } });
      return a;
    });
  } catch (e) {
    if (isExclusionViolation(e)) throw new DomainError("reservation.conflict");
    throw e;
  }
}

export async function removeBlock(actor: Actor, allocationId: string) {
  assertCan(actor, "inventory.write");
  return withTenant(ctx(actor), async (tx) => {
    const rows = await tx.query("update allocations set active = false where id = $1 and org_id = $2 and kind <> 'rental' returning id", [allocationId, actor.orgId]);
    if (!rows[0]) throw new DomainError("common.notFound");
  });
}

export type ReservationListRow = {
  id: string; number: string; status: ReservationStatus; source: string; starts_at: Date; ends_at: Date; total_cents: number;
  deposit_cents: number; customer_name: string; customer_id: string; items_summary: string; unit_count: number;
};

export async function listReservations(actor: Actor, opts: { status?: string; q?: string; scope?: "upcoming" | "active" | "past" | "all" } = {}) {
  assertCan(actor, "reservations.read");
  return withTenant(ctx(actor), (tx) =>
    tx.query<ReservationListRow>(
      `select r.id, r.number, r.status, r.source, r.starts_at, r.ends_at, r.total_cents, r.deposit_cents, c.name as customer_name, c.id as customer_id,
              (select string_agg(ri.quantity || '× ' || l.title, ', ') from reservation_items ri join listings l on l.id = ri.listing_id where ri.reservation_id = r.id) as items_summary,
              (select count(*)::int from allocations a where a.reservation_id = r.id and a.active) as unit_count
         from reservations r join customers c on c.id = r.customer_id
        where r.org_id = $1
          and ($2::reservation_status is null or r.status = $2)
          and ($3::text is null or r.number ilike '%'||$3||'%' or c.name ilike '%'||$3||'%')
          and case $4
                when 'upcoming' then r.starts_at >= now() and r.status not in ('cancelled','expired')
                when 'active' then r.status in ('active','awaiting_return','overdue')
                when 'past' then r.ends_at < now()
                else true end
        order by case when $4 = 'past' then -extract(epoch from r.starts_at) else extract(epoch from r.starts_at) end
        limit 500`,
      [actor.orgId, opts.status || null, opts.q?.trim() || null, opts.scope ?? "all"],
    ),
  );
}

export async function getReservation(actor: Actor, id: string) {
  assertCan(actor, "reservations.read");
  return withTenant(ctx(actor), async (tx) => {
    const reservation = await tx.maybeOne<ReservationListRow & { notes: string | null; subtotal_cents: number; discount_cents: number; currency: string; created_at: Date; customer_email: string | null; customer_phone: string | null }>(
      `select r.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, '' as items_summary, 0 as unit_count
         from reservations r join customers c on c.id = r.customer_id where r.id = $1 and r.org_id = $2`,
      [id, actor.orgId],
    );
    if (!reservation) return null;
    const items = await tx.query<{ id: string; listing_id: string; title: string; quantity: number; unit_price_cents: number; line_total_cents: number; pricing_basis: string }>(
      `select ri.id, ri.listing_id, l.title, ri.quantity, ri.unit_price_cents, ri.line_total_cents, ri.pricing_basis
         from reservation_items ri join listings l on l.id = ri.listing_id where ri.reservation_id = $1 order by l.title`, [id]);
    const allocations = await tx.query<{ id: string; item_id: string; unit_id: string; internal_code: string; unit_status: UnitStatus; active: boolean }>(
      `select a.id, a.item_id, a.unit_id, u.internal_code, u.status as unit_status, a.active
         from allocations a join units u on u.id = a.unit_id where a.reservation_id = $1 order by u.internal_code`, [id]);
    const events = await tx.query<{ action: string; data: Record<string, unknown>; created_at: Date; actor: string | null }>(
      `select al.action, al.data, al.created_at, u.full_name as actor from audit_logs al left join users u on u.id = al.actor_user_id
        where al.entity_type = 'reservation' and al.entity_id = $1 order by al.created_at desc limit 50`, [id]);
    return { reservation, items, allocations, events };
  });
}

/** Resource timeline data: every bookable unit with its allocations overlapping the window. */
export async function getTimeline(actor: Actor, from: Date, to: Date, opts: { locationId?: string | null } = {}) {
  assertCan(actor, "reservations.read");
  return withTenant(ctx(actor), async (tx) => {
    const units = await tx.query<{ id: string; internal_code: string; status: UnitStatus; listing_id: string; listing_title: string; location_id: string | null; buffer_minutes: number }>(
      `select u.id, u.internal_code, u.status, u.listing_id, l.title as listing_title, u.location_id, l.buffer_minutes
         from units u join listings l on l.id = u.listing_id
        where u.org_id = $1 and u.status <> 'retired' and ($2::uuid is null or u.location_id = $2)
        order by l.title, u.internal_code`,
      [actor.orgId, opts.locationId ?? null],
    );
    const allocations = await tx.query<{ id: string; unit_id: string; kind: string; starts_at: Date; ends_at: Date; blocked_until: Date; reservation_id: string | null; number: string | null; status: ReservationStatus | null; customer: string | null; source: string | null; note: string | null }>(
      `select a.id, a.unit_id, a.kind, lower(a.period) as starts_at, upper(a.period) as ends_at, upper(a.blocked) as blocked_until,
              a.reservation_id, r.number, r.status, c.name as customer, r.source, a.note
         from allocations a left join reservations r on r.id = a.reservation_id left join customers c on c.id = r.customer_id
        where a.org_id = $1 and a.active and a.blocked && tstzrange($2, $3)`,
      [actor.orgId, from, to],
    );
    return { units, allocations };
  });
}
