import { describe, expect, it } from "vitest";
import { addUnits, changeUnitStatus, getUnit, generateCodes } from "@/server/services/inventory";
import {
  checkAvailability, createBlock, createReservation, getReservation, getTimeline, reassignAllocation, rescheduleReservation, transitionReservation,
} from "@/server/services/reservations";
import { getDashboard } from "@/server/services/dashboard";
import { d, makeCustomer, makeListing, makeOrg } from "../support/factory";

describe("reservations & availability", () => {
  it("manages multiple identical units under one listing", async () => {
    const { owner } = await makeOrg("Multi");
    const { listing } = await makeListing(owner, { units: 5 });
    const c = await makeCustomer(owner);
    const period = { startsAt: d("2027-06-01T08:00:00Z"), endsAt: d("2027-06-04T08:00:00Z") };
    expect((await checkAvailability(owner, listing.id, period.startsAt, period.endsAt)).available).toBe(5);
    const r1 = await createReservation(owner, { customerId: c.id, ...period, items: [{ listingId: listing.id, quantity: 3 }] });
    expect((await checkAvailability(owner, listing.id, period.startsAt, period.endsAt)).available).toBe(2);
    await expect(createReservation(owner, { customerId: c.id, ...period, items: [{ listingId: listing.id, quantity: 3 }] })).rejects.toThrow(/reservation.unavailable/);
    const detail = await getReservation(owner, r1.id);
    expect(detail!.allocations).toHaveLength(3);
    expect(new Set(detail!.allocations.map((a) => a.unit_id)).size).toBe(3);
    // 3 days × 35 € × 3 units
    expect(detail!.reservation.total_cents).toBe(3 * 3500 * 3);
    expect(detail!.reservation.deposit_cents).toBe(3 * 20000);
    expect(r1.number).toMatch(/^R-\d{4}-00001$/);
  });

  it("prevents double booking under concurrent attempts", async () => {
    const { owner } = await makeOrg("Race");
    const { listing } = await makeListing(owner, { units: 1 });
    const c = await makeCustomer(owner);
    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        createReservation(owner, {
          customerId: c.id,
          startsAt: d(`2027-07-01T0${i % 3}:00:00Z`),
          endsAt: d("2027-07-02T12:00:00Z"),
          items: [{ listingId: listing.id, quantity: 1 }],
        }),
      ),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled");
    expect(ok).toHaveLength(1);
    for (const f of attempts.filter((a) => a.status === "rejected")) {
      expect(String((f as PromiseRejectedResult).reason)).toMatch(/reservation\.(unavailable|conflict)/);
    }
  });

  it("respects buffer time between rentals and allows back-to-back without buffer", async () => {
    const { owner } = await makeOrg("Buffer");
    const buffered = await makeListing(owner, { units: 1, buffer: 120, title: "Bager 1,8 t" });
    const plain = await makeListing(owner, { units: 1, title: "Vibro plošča" });
    const c = await makeCustomer(owner);
    for (const l of [buffered, plain]) {
      await createReservation(owner, { customerId: c.id, startsAt: d("2027-08-01T08:00:00Z"), endsAt: d("2027-08-02T08:00:00Z"), items: [{ listingId: l.listing.id, quantity: 1 }] });
    }
    const next = { startsAt: d("2027-08-02T09:00:00Z"), endsAt: d("2027-08-03T09:00:00Z") };
    await expect(createReservation(owner, { customerId: c.id, ...next, items: [{ listingId: buffered.listing.id, quantity: 1 }] })).rejects.toThrow(/unavailable/);
    await createReservation(owner, { customerId: c.id, startsAt: d("2027-08-02T10:00:00Z"), endsAt: d("2027-08-03T10:00:00Z"), items: [{ listingId: buffered.listing.id, quantity: 1 }] });
    await createReservation(owner, { customerId: c.id, startsAt: d("2027-08-02T08:00:00Z"), endsAt: d("2027-08-03T08:00:00Z"), items: [{ listingId: plain.listing.id, quantity: 1 }] });
  });

  it("blocks bookings during maintenance and rejects maintenance over a rental", async () => {
    const { owner } = await makeOrg("Maint");
    const { listing, units } = await makeListing(owner, { units: 1 });
    const c = await makeCustomer(owner);
    await createBlock(owner, { unitId: units[0].id, kind: "maintenance", startsAt: d("2027-09-10T00:00:00Z"), endsAt: d("2027-09-12T00:00:00Z"), note: "Servis" });
    await expect(createReservation(owner, { customerId: c.id, startsAt: d("2027-09-11T08:00:00Z"), endsAt: d("2027-09-13T08:00:00Z"), items: [{ listingId: listing.id, quantity: 1 }] })).rejects.toThrow(/unavailable/);
    await createReservation(owner, { customerId: c.id, startsAt: d("2027-09-20T08:00:00Z"), endsAt: d("2027-09-22T08:00:00Z"), items: [{ listingId: listing.id, quantity: 1 }] });
    await expect(createBlock(owner, { unitId: units[0].id, kind: "maintenance", startsAt: d("2027-09-21T00:00:00Z"), endsAt: d("2027-09-21T12:00:00Z") })).rejects.toThrow(/reservation.conflict/);
  });

  it("runs the lifecycle, syncs unit status and releases units on cancel", async () => {
    const { owner } = await makeOrg("Lifecycle");
    const { listing, units } = await makeListing(owner, { units: 1 });
    const c = await makeCustomer(owner);
    const p = { startsAt: d("2027-10-01T08:00:00Z"), endsAt: d("2027-10-02T08:00:00Z") };
    const r = await createReservation(owner, { customerId: c.id, ...p, items: [{ listingId: listing.id, quantity: 1 }] });
    await expect(transitionReservation(owner, r.id, "completed")).rejects.toThrow(/Invalid reservation transition/);
    await transitionReservation(owner, r.id, "active");
    expect((await getUnit(owner, units[0].id))!.unit.status).toBe("rented");
    await expect(transitionReservation(owner, r.id, "cancelled")).rejects.toThrow(/Invalid/);
    await transitionReservation(owner, r.id, "inspection");
    await transitionReservation(owner, r.id, "completed");
    expect((await getUnit(owner, units[0].id))!.unit.status).toBe("available");

    const r2 = await createReservation(owner, { customerId: c.id, startsAt: d("2027-11-01T08:00:00Z"), endsAt: d("2027-11-02T08:00:00Z"), items: [{ listingId: listing.id, quantity: 1 }] });
    await transitionReservation(owner, r2.id, "cancelled");
    // the same slot is free again
    await createReservation(owner, { customerId: c.id, startsAt: d("2027-11-01T08:00:00Z"), endsAt: d("2027-11-02T08:00:00Z"), items: [{ listingId: listing.id, quantity: 1 }] });
  });

  it("reschedules with server-side conflict validation and reprices", async () => {
    const { owner } = await makeOrg("Resched");
    const { listing, units } = await makeListing(owner, { units: 2 });
    const c = await makeCustomer(owner);
    const r1 = await createReservation(owner, { customerId: c.id, startsAt: d("2027-12-01T08:00:00Z"), endsAt: d("2027-12-02T08:00:00Z"), items: [{ listingId: listing.id, quantity: 1 }] });
    const r2 = await createReservation(owner, { customerId: c.id, startsAt: d("2027-12-05T08:00:00Z"), endsAt: d("2027-12-06T08:00:00Z"), items: [{ listingId: listing.id, quantity: 1 }] });
    // both on the first unit (sorted by code)
    const a2 = (await getReservation(owner, r2.id))!.allocations[0];
    expect(a2.unit_id).toBe(units[0].id);
    await expect(rescheduleReservation(owner, r2.id, d("2027-12-01T12:00:00Z"), d("2027-12-03T08:00:00Z"))).rejects.toThrow(/reservation.conflict/);
    await reassignAllocation(owner, a2.id, units[1].id);
    await rescheduleReservation(owner, r2.id, d("2027-12-01T12:00:00Z"), d("2027-12-08T13:00:00Z"));
    const after = (await getReservation(owner, r2.id))!;
    expect(after.reservation.total_cents).toBe(17500 + 3500); // 8 billable days = 1 week + 1 day
    expect(r1.id).toBeTruthy();
    const tl = await getTimeline(owner, d("2027-11-30T00:00:00Z"), d("2027-12-10T00:00:00Z"));
    expect(tl.units).toHaveLength(2);
    expect(tl.allocations).toHaveLength(2);
  });

  it("enforces subscription unit limits", async () => {
    const { owner } = await makeOrg("Basic plan", "basic");
    const { listing } = await makeListing(owner, { units: 25 });
    await expect(addUnits(owner, listing.id, generateCodes("X", 1, 6).map((internalCode) => ({ internalCode })))).rejects.toThrow(/plan.unitLimit/);
    await addUnits(owner, listing.id, generateCodes("X", 1, 5).map((internalCode) => ({ internalCode })));
    await expect(addUnits(owner, listing.id, [{ internalCode: "X-001" }])).rejects.toThrow();
  });

  it("rejects invalid unit transitions and records history", async () => {
    const { owner } = await makeOrg("Unit SM");
    const { units } = await makeListing(owner, { units: 1 });
    await changeUnitStatus(owner, units[0].id, "damaged", "Poškodovan kabel");
    await expect(changeUnitStatus(owner, units[0].id, "available")).rejects.toThrow(/Invalid unit transition/);
    await changeUnitStatus(owner, units[0].id, "maintenance");
    const u = (await getUnit(owner, units[0].id))!;
    expect(u.history.map((h) => h.to_status)).toEqual(["maintenance", "damaged", "available"]);
  });

  it("builds the dashboard from real data", async () => {
    const { owner } = await makeOrg("Dash");
    const { listing } = await makeListing(owner, { units: 2 });
    const c = await makeCustomer(owner);
    const now = Date.now();
    const r = await createReservation(owner, { customerId: c.id, source: "marketplace", startsAt: new Date(now - 3600_000), endsAt: new Date(now + 86400_000), items: [{ listingId: listing.id, quantity: 1 }] });
    await transitionReservation(owner, r.id, "active");
    const dash = await getDashboard(owner);
    expect(dash.counts.active).toBe(1);
    expect(dash.revenue.marketplace).toBeGreaterThan(0);
    expect(dash.units.find((u) => u.status === "rented")?.count).toBe(1);
    expect(dash.activity.length).toBeGreaterThan(0);
  });
});
