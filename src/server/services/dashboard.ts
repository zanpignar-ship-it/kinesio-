import { withTenant } from "../db";
import { assertCan, ctx, type Actor } from "./actor";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/**
 * Operational dashboard. "Booked revenue" is the value of non-cancelled
 * reservations by start date; it is NOT collected cash (payments arrive in Phase 3).
 */
export async function getDashboard(actor: Actor) {
  assertCan(actor, "reservations.read");
  return withTenant(ctx(actor), async (tx) => {
    const tz = (await tx.one<{ timezone: string }>("select timezone from organizations where id = $1", [actor.orgId])).timezone;
    const params = [actor.orgId, tz];
    const today = `(now() at time zone $2)::date`;
    const day = (col: string) => `(${col} at time zone $2)::date`;

    const pickups = await tx.query<{ id: string; number: string; customer: string; starts_at: Date; status: string; items: string }>(
      `select r.id, r.number, c.name as customer, r.starts_at, r.status,
              (select string_agg(ri.quantity || '× ' || l.title, ', ') from reservation_items ri join listings l on l.id = ri.listing_id where ri.reservation_id = r.id) as items
         from reservations r join customers c on c.id = r.customer_id
        where r.org_id = $1 and ${day("r.starts_at")} = ${today} and r.status in ('confirmed','awaiting_pickup','awaiting_confirmation')
        order by r.starts_at`, params);
    const returns = await tx.query<{ id: string; number: string; customer: string; ends_at: Date; status: string; items: string }>(
      `select r.id, r.number, c.name as customer, r.ends_at, r.status,
              (select string_agg(ri.quantity || '× ' || l.title, ', ') from reservation_items ri join listings l on l.id = ri.listing_id where ri.reservation_id = r.id) as items
         from reservations r join customers c on c.id = r.customer_id
        where r.org_id = $1 and ${day("r.ends_at")} = ${today} and r.status in ('active','awaiting_return')
        order by r.ends_at`, params);
    const overdue = await tx.query<{ id: string; number: string; customer: string; ends_at: Date; status: string }>(
      `select r.id, r.number, c.name as customer, r.ends_at, r.status from reservations r join customers c on c.id = r.customer_id
        where r.org_id = $1 and (r.status = 'overdue' or (r.status in ('active','awaiting_return') and r.ends_at < now()))
        order by r.ends_at`, [actor.orgId]);

    const counts = await tx.one<{ active: number; upcoming7: number; awaiting_confirmation: number; deposits_cents: number }>(
      `select count(*) filter (where status in ('active','awaiting_return','overdue'))::int as active,
              count(*) filter (where status in ('confirmed','awaiting_pickup') and starts_at between now() and now() + interval '7 days')::int as upcoming7,
              count(*) filter (where status = 'awaiting_confirmation')::int as awaiting_confirmation,
              coalesce(sum(deposit_cents) filter (where status in ('active','awaiting_return','overdue','inspection')), 0)::int as deposits_cents
         from reservations where org_id = $1`, [actor.orgId]);

    const revenue = await tx.one<{ today: number; month: number; prev_month: number; marketplace: number; direct: number }>(
      `with r as (select * from reservations where org_id = $1 and status not in ('cancelled','expired','draft','quotation'))
       select coalesce(sum(total_cents) filter (where ${day("starts_at")} = ${today}), 0)::int as today,
              coalesce(sum(total_cents) filter (where date_trunc('month', starts_at at time zone $2) = date_trunc('month', now() at time zone $2)), 0)::int as month,
              coalesce(sum(total_cents) filter (where date_trunc('month', starts_at at time zone $2) = date_trunc('month', now() at time zone $2) - interval '1 month'
                                                 and (starts_at at time zone $2) <= (now() at time zone $2) - interval '1 month'), 0)::int as prev_month,
              coalesce(sum(total_cents) filter (where source = 'marketplace' and date_trunc('month', starts_at at time zone $2) = date_trunc('month', now() at time zone $2)), 0)::int as marketplace,
              coalesce(sum(total_cents) filter (where source <> 'marketplace' and date_trunc('month', starts_at at time zone $2) = date_trunc('month', now() at time zone $2)), 0)::int as direct
         from r`, params);

    const units = await tx.query<{ status: string; count: number }>(
      "select status::text, count(*)::int as count from units where org_id = $1 and status <> 'retired' group by status", [actor.orgId]);

    // Utilization over the trailing 30 days: rented unit-hours / available unit-hours.
    const utilization = await tx.one<{ ratio: number | null }>(
      `with w as (select now() - interval '30 days' as s, now() as e),
            u as (select count(*) as n from units where org_id = $1 and status <> 'retired'),
            booked as (
              select coalesce(sum(extract(epoch from (least(upper(a.period), w.e) - greatest(lower(a.period), w.s)))), 0) as secs
                from allocations a, w
               where a.org_id = $1 and a.active and a.kind = 'rental' and a.period && tstzrange(w.s, w.e))
       select case when u.n = 0 then null else booked.secs / (u.n * 30 * 86400.0) end as ratio from u, booked`, [actor.orgId]);

    const weekly = await tx.query<{ day: string; booked_cents: number }>(
      `select to_char(d, 'YYYY-MM-DD') as day,
              coalesce((select sum(total_cents) from reservations r where r.org_id = $1 and r.status not in ('cancelled','expired','draft','quotation')
                          and (r.starts_at at time zone $2)::date = d), 0)::int as booked_cents
         from generate_series(${today} - 13, ${today}, interval '1 day') as d order by d`, params);

    const activity = await tx.query<{ action: string; entity_type: string; entity_id: string | null; data: Record<string, unknown>; created_at: Date; actor: string | null }>(
      `select al.action, al.entity_type, al.entity_id, al.data, al.created_at, u.full_name as actor
         from audit_logs al left join users u on u.id = al.actor_user_id where al.org_id = $1 order by al.created_at desc limit 8`, [actor.orgId]);

    const maintenance = await tx.query<{ id: string; internal_code: string; listing_title: string; status: string }>(
      `select u.id, u.internal_code, l.title as listing_title, u.status from units u join listings l on l.id = u.listing_id
        where u.org_id = $1 and u.status in ('damaged','maintenance','inspection') order by u.updated_at desc limit 10`, [actor.orgId]);

    return { pickups, returns, overdue, counts, revenue, units, utilization: utilization.ratio, weekly, activity, maintenance };
  });
}
