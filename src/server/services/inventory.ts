import { z } from "zod";
import { withTenant, withPublic, isUniqueViolation, type Tx } from "../db";
import { DomainError } from "../errors";
import { audit } from "../audit";
import { assertCan, ctx, type Actor } from "./actor";
import { getPlanLimits, slugify } from "./organizations";
import { unitMachine, UNIT_STATUSES, type UnitStatus } from "@/domain/unit";

const cents = z.number().int().min(0).max(100_000_000);

export const listingSchema = z.object({
  title: z.string().trim().min(2).max(200),
  categoryId: z.string().uuid(),
  locationId: z.string().uuid().optional().nullable(),
  description: z.string().trim().max(10_000).default(""),
  manufacturer: z.string().trim().max(120).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  specs: z.record(z.string(), z.string().max(200)).default({}),
  priceDayCents: cents,
  priceWeekCents: cents.optional().nullable(),
  priceMonthCents: cents.optional().nullable(),
  depositCents: cents.default(0),
  bufferMinutes: z.number().int().min(0).max(10080).default(0),
  bookingMode: z.enum(["instant", "request"]).default("request"),
  deliveryAvailable: z.boolean().default(false),
  isPublished: z.boolean().default(false),
});

export type Listing = {
  id: string; org_id: string; category_id: string; location_id: string | null; title: string; slug: string; description: string;
  manufacturer: string | null; model: string | null; specs: Record<string, string>; price_day_cents: number;
  price_week_cents: number | null; price_month_cents: number | null; deposit_cents: number; buffer_minutes: number;
  booking_mode: "instant" | "request"; delivery_available: boolean; is_published: boolean; created_at: string;
};

export type ListingRow = Listing & { category_name: Record<string, string>; unit_count: number; available_now: number };

export async function listCategories() {
  return withPublic((tx) =>
    tx.query<{ id: string; slug: string; name_i18n: Record<string, string> }>("select id, slug, name_i18n from categories order by sort"),
  );
}

export async function listListings(actor: Actor, opts: { q?: string } = {}) {
  assertCan(actor, "inventory.read");
  return withTenant(ctx(actor), (tx) =>
    tx.query<ListingRow>(
      `select l.*, c.name_i18n as category_name,
              count(u.id)::int as unit_count,
              count(u.id) filter (where u.status = 'available')::int as available_now
         from listings l
         join categories c on c.id = l.category_id
         left join units u on u.listing_id = l.id and u.status <> 'retired'
        where l.org_id = $1 and ($2::text is null or l.title ilike '%' || $2 || '%' or l.manufacturer ilike '%' || $2 || '%' or l.model ilike '%' || $2 || '%')
        group by l.id, c.name_i18n
        order by l.title`,
      [actor.orgId, opts.q?.trim() || null],
    ),
  );
}

export async function getListing(actor: Actor, id: string) {
  assertCan(actor, "inventory.read");
  return withTenant(ctx(actor), async (tx) => {
    const listing = await tx.maybeOne<ListingRow>(
      `select l.*, c.name_i18n as category_name, 0 as unit_count, 0 as available_now
         from listings l join categories c on c.id = l.category_id where l.id = $1 and l.org_id = $2`,
      [id, actor.orgId],
    );
    if (!listing) return null;
    const units = await tx.query<UnitRow>(
      `${UNIT_SELECT} where u.listing_id = $1 order by u.internal_code`,
      [id],
    );
    return { listing, units };
  });
}

export async function createListing(actor: Actor, input: z.input<typeof listingSchema>) {
  assertCan(actor, "inventory.write");
  const d = listingSchema.parse(input);
  return withTenant(ctx(actor), async (tx) => {
    const base = slugify(d.title);
    let slug = base;
    for (let i = 2; await tx.maybeOne("select 1 from listings where org_id = $1 and slug = $2", [actor.orgId, slug]); i++) slug = `${base}-${i}`;
    const l = await tx.one<Listing>(
      `insert into listings (org_id, category_id, location_id, title, slug, description, manufacturer, model, specs,
          price_day_cents, price_week_cents, price_month_cents, deposit_cents, buffer_minutes, booking_mode, delivery_available, is_published)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning *`,
      [actor.orgId, d.categoryId, d.locationId ?? null, d.title, slug, d.description, d.manufacturer ?? null, d.model ?? null,
       JSON.stringify(d.specs), d.priceDayCents, d.priceWeekCents ?? null, d.priceMonthCents ?? null, d.depositCents,
       d.bufferMinutes, d.bookingMode, d.deliveryAvailable, d.isPublished],
    );
    await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "listing.created", entityType: "listing", entityId: l.id });
    return l;
  });
}

export async function updateListing(actor: Actor, id: string, input: z.input<typeof listingSchema>) {
  assertCan(actor, "inventory.write");
  const d = listingSchema.parse(input);
  return withTenant(ctx(actor), async (tx) => {
    const rows = await tx.query<Listing>(
      `update listings set category_id=$3, location_id=$4, title=$5, description=$6, manufacturer=$7, model=$8, specs=$9,
          price_day_cents=$10, price_week_cents=$11, price_month_cents=$12, deposit_cents=$13, buffer_minutes=$14,
          booking_mode=$15, delivery_available=$16, is_published=$17
        where id=$1 and org_id=$2 returning *`,
      [id, actor.orgId, d.categoryId, d.locationId ?? null, d.title, d.description, d.manufacturer ?? null, d.model ?? null,
       JSON.stringify(d.specs), d.priceDayCents, d.priceWeekCents ?? null, d.priceMonthCents ?? null, d.depositCents,
       d.bufferMinutes, d.bookingMode, d.deliveryAvailable, d.isPublished],
    );
    if (!rows[0]) throw new DomainError("common.notFound");
    await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "listing.updated", entityType: "listing", entityId: id });
    return rows[0];
  });
}

// ---------------------------------------------------------------------------
// Physical units
// ---------------------------------------------------------------------------

export type UnitRow = {
  id: string; listing_id: string; listing_title: string; internal_code: string; serial_number: string | null; qr_token: string;
  status: UnitStatus; purchase_price_cents: number | null; purchase_date: string | null; replacement_value_cents: number | null;
  operating_hours: string | null; notes: string | null; location_name: string | null; next_start: string | null; current_reservation: string | null;
};

const UNIT_SELECT = `
  select u.*, l.title as listing_title, loc.name as location_name,
    (select lower(a.period) from allocations a where a.unit_id = u.id and a.active and lower(a.period) > now() order by lower(a.period) limit 1) as next_start,
    (select r.number from allocations a join reservations r on r.id = a.reservation_id
      where a.unit_id = u.id and a.active and a.period @> now() limit 1) as current_reservation
  from units u join listings l on l.id = u.listing_id left join locations loc on loc.id = u.location_id`;

export const unitSchema = z.object({
  internalCode: z.string().trim().min(1).max(60),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  purchasePriceCents: cents.optional().nullable(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  replacementValueCents: cents.optional().nullable(),
  operatingHours: z.number().min(0).max(10_000_000).optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

async function assertUnitCapacity(tx: Tx, orgId: string, adding: number) {
  const plan = await getPlanLimits(tx, orgId);
  const limit = plan.limits.units;
  if (limit == null) return;
  const { count } = await tx.one<{ count: number }>("select count(*)::int as count from units where org_id = $1 and status <> 'retired'", [orgId]);
  if (count + adding > limit) throw new DomainError("plan.unitLimit", undefined, { limit, plan: plan.name });
}

export async function addUnits(actor: Actor, listingId: string, units: z.input<typeof unitSchema>[]) {
  assertCan(actor, "inventory.write");
  const parsed = units.map((u) => unitSchema.parse(u));
  if (parsed.length === 0 || parsed.length > 200) throw new DomainError("units.invalidCount");
  return withTenant(ctx(actor), async (tx) => {
    const listing = await tx.maybeOne<{ id: string; location_id: string | null }>("select id, location_id from listings where id = $1 and org_id = $2 for update", [listingId, actor.orgId]);
    if (!listing) throw new DomainError("common.notFound");
    // serialize capacity checks per organization
    await tx.query("select 1 from organizations where id = $1 for update", [actor.orgId]);
    await assertUnitCapacity(tx, actor.orgId, parsed.length);
    const created: { id: string; internal_code: string }[] = [];
    for (const u of parsed) {
      try {
        await tx.query("savepoint unit_insert");
        const row = await tx.one<{ id: string; internal_code: string }>(
          `insert into units (org_id, listing_id, location_id, internal_code, serial_number, purchase_price_cents, purchase_date,
              replacement_value_cents, operating_hours, notes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, internal_code`,
          [actor.orgId, listingId, u.locationId ?? listing.location_id, u.internalCode, u.serialNumber ?? null, u.purchasePriceCents ?? null,
           u.purchaseDate ?? null, u.replacementValueCents ?? null, u.operatingHours ?? null, u.notes ?? null],
        );
        await tx.query("release savepoint unit_insert");
        await tx.query("insert into unit_status_history (org_id, unit_id, from_status, to_status, actor_user_id, reason) values ($1,$2,null,'available',$3,'Dodano v inventar')", [actor.orgId, row.id, actor.userId]);
        created.push(row);
      } catch (e) {
        if (isUniqueViolation(e)) throw new DomainError("units.duplicateCode", undefined, { code: u.internalCode });
        throw e;
      }
    }
    await audit(tx, { orgId: actor.orgId, actorUserId: actor.userId, action: "units.created", entityType: "listing", entityId: listingId, data: { count: created.length } });
    return created;
  });
}

/** Suggests sequential inventory codes, e.g. "MKT-HM-001", "MKT-HM-002". */
export function generateCodes(prefix: string, start: number, count: number) {
  const p = prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") || "UNIT";
  return Array.from({ length: count }, (_, i) => `${p}-${String(start + i).padStart(3, "0")}`);
}

export async function nextCodeNumber(actor: Actor, prefix: string) {
  return withTenant(ctx(actor), async (tx) => {
    const p = prefix.trim().toUpperCase();
    const rows = await tx.query<{ internal_code: string }>("select internal_code from units where internal_code like $1", [`${p}-%`]);
    const max = rows.reduce((m, r) => Math.max(m, Number(r.internal_code.slice(p.length + 1)) || 0), 0);
    return max + 1;
  });
}

export async function listUnits(actor: Actor, opts: { status?: UnitStatus; q?: string } = {}) {
  assertCan(actor, "inventory.read");
  return withTenant(ctx(actor), (tx) =>
    tx.query<UnitRow>(
      `${UNIT_SELECT}
        where u.org_id = $1 and ($2::unit_status is null or u.status = $2)
          and ($3::text is null or u.internal_code ilike '%'||$3||'%' or u.serial_number ilike '%'||$3||'%' or l.title ilike '%'||$3||'%')
        order by l.title, u.internal_code limit 1000`,
      [actor.orgId, opts.status && (UNIT_STATUSES as readonly string[]).includes(opts.status) ? opts.status : null, opts.q?.trim() || null],
    ),
  );
}

export async function getUnit(actor: Actor, id: string) {
  assertCan(actor, "inventory.read");
  return withTenant(ctx(actor), async (tx) => {
    const unit = await tx.maybeOne<UnitRow>(`${UNIT_SELECT} where u.id = $1 and u.org_id = $2`, [id, actor.orgId]);
    if (!unit) return null;
    return { unit, ...(await unitDetails(tx, id)) };
  });
}

/** Resolve a QR token to a unit within the actor's organization only. */
export async function getUnitByQr(actor: Actor, token: string) {
  assertCan(actor, "inventory.read");
  if (!/^[a-f0-9]{24}$/.test(token)) return Promise.resolve(null);
  return withTenant(ctx(actor), async (tx) => {
    const unit = await tx.maybeOne<UnitRow>(`${UNIT_SELECT} where u.qr_token = $1 and u.org_id = $2`, [token, actor.orgId]);
    if (!unit) return null;
    return { unit, ...(await unitDetails(tx, unit.id)) };
  });
}

async function unitDetails(tx: Tx, unitId: string) {
  const history = await tx.query<{ from_status: UnitStatus | null; to_status: UnitStatus; reason: string | null; created_at: string; actor: string | null }>(
    `select h.from_status, h.to_status, h.reason, h.created_at, us.full_name as actor
       from unit_status_history h left join users us on us.id = h.actor_user_id
      where h.unit_id = $1 order by h.created_at desc limit 50`,
    [unitId],
  );
  const allocations = await tx.query<{ id: string; kind: string; starts_at: string; ends_at: string; reservation_id: string | null; number: string | null; status: string | null; customer: string | null; note: string | null }>(
    `select a.id, a.kind, lower(a.period) as starts_at, upper(a.period) as ends_at, a.reservation_id, r.number, r.status, c.name as customer, a.note
       from allocations a left join reservations r on r.id = a.reservation_id left join customers c on c.id = r.customer_id
      where a.unit_id = $1 and a.active order by lower(a.period) desc limit 50`,
    [unitId],
  );
  const stats = await tx.one<{ rentals: number; revenue_cents: number }>(
    `select count(distinct r.id)::int as rentals,
            coalesce(sum(ri.unit_price_cents) filter (where r.status not in ('cancelled','expired','draft','quotation')), 0)::int as revenue_cents
       from allocations a join reservations r on r.id = a.reservation_id join reservation_items ri on ri.id = a.item_id
      where a.unit_id = $1 and a.kind = 'rental'`,
    [unitId],
  );
  return { history, allocations, stats };
}

export async function changeUnitStatus(actor: Actor, unitId: string, to: UnitStatus, reason?: string) {
  assertCan(actor, "units.status");
  return withTenant(ctx(actor), (tx) => transitionUnit(tx, actor, unitId, to, reason));
}

export async function transitionUnit(tx: Tx, actor: Actor, unitId: string, to: UnitStatus, reason?: string | null) {
  const u = await tx.maybeOne<{ status: UnitStatus }>("select status from units where id = $1 and org_id = $2 for update", [unitId, actor.orgId]);
  if (!u) throw new DomainError("common.notFound");
  if (u.status === to) return;
  unitMachine.assert(u.status, to);
  await tx.query("update units set status = $2 where id = $1", [unitId, to]);
  await tx.query(
    "insert into unit_status_history (org_id, unit_id, from_status, to_status, actor_user_id, reason) values ($1,$2,$3,$4,$5,$6)",
    [actor.orgId, unitId, u.status, to, actor.userId, reason?.slice(0, 500) ?? null],
  );
}
