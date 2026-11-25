import { describe, expect, it } from "vitest";
import { withTenant, withPublic } from "@/server/db";
import { getListing, getUnit, getUnitByQr, listListings, listUnits, changeUnitStatus } from "@/server/services/inventory";
import { getCustomer, listCustomers } from "@/server/services/customers";
import { createReservation, getReservation, transitionReservation } from "@/server/services/reservations";
import { addMember, d, makeCustomer, makeListing, makeOrg } from "../support/factory";

describe("tenant isolation", () => {
  it("never exposes another organization's private data", async () => {
    const a = await makeOrg("Najem A");
    const b = await makeOrg("Najem B");
    const { listing: la, units: ua } = await makeListing(a.owner);
    const ca = await makeCustomer(a.owner);
    const ra = await createReservation(a.owner, { customerId: ca.id, startsAt: d("2027-03-01T08:00:00Z"), endsAt: d("2027-03-03T08:00:00Z"), items: [{ listingId: la.id, quantity: 1 }] });

    // Service layer: B sees nothing of A
    expect(await listListings(b.owner)).toHaveLength(0);
    expect(await listUnits(b.owner)).toHaveLength(0);
    expect(await listCustomers(b.owner)).toHaveLength(0);
    expect(await getListing(b.owner, la.id)).toBeNull();
    expect(await getUnit(b.owner, ua[0].id)).toBeNull();
    expect(await getCustomer(b.owner, ca.id)).toBeNull();
    expect(await getReservation(b.owner, ra.id)).toBeNull();

    // Mutations against foreign ids fail
    await expect(changeUnitStatus(b.owner, ua[0].id, "maintenance")).rejects.toThrow(/common.notFound/);
    await expect(transitionReservation(b.owner, ra.id, "cancelled")).rejects.toThrow(/common.notFound/);
    await expect(createReservation(b.owner, { customerId: ca.id, startsAt: d("2027-04-01T08:00:00Z"), endsAt: d("2027-04-02T08:00:00Z"), items: [{ listingId: la.id, quantity: 1 }] })).rejects.toThrow();

    // QR tokens resolve only inside the owning organization
    const qr = (await getUnit(a.owner, ua[0].id))!.unit.qr_token;
    expect(await getUnitByQr(b.owner, qr)).toBeNull();
    expect((await getUnitByQr(a.owner, qr))?.unit.id).toBe(ua[0].id);
  });

  it("enforces isolation in the database itself (RLS), even for raw SQL", async () => {
    const a = await makeOrg("RLS A");
    const b = await makeOrg("RLS B");
    const { units } = await makeListing(a.owner);
    await withTenant({ orgId: b.org.id }, async (tx) => {
      expect(await tx.query("select * from units")).toHaveLength(0);
      expect(await tx.query("select * from customers")).toHaveLength(0);
      const upd = await tx.query("update units set notes = 'pwned' where id = $1 returning id", [units[0].id]);
      expect(upd).toHaveLength(0);
    });
    // Insert with a foreign org_id is rejected by WITH CHECK
    await expect(
      withTenant({ orgId: b.org.id }, (tx) => tx.query("insert into customers (org_id, name) values ($1, 'x')", [a.org.id])),
    ).rejects.toThrow(/row-level security/);
    // No tenant context: private tables are invisible
    await withPublic(async (tx) => {
      expect(await tx.query("select * from units")).toHaveLength(0);
      expect(await tx.query("select * from reservations")).toHaveLength(0);
    });
  });

  it("only exposes published listings publicly", async () => {
    const a = await makeOrg("Public A");
    const { listing } = await makeListing(a.owner);
    const visible = () => withPublic((tx) => tx.query("select id from listings where id = $1", [listing.id]));
    expect(await visible()).toHaveLength(0);
    await withTenant({ orgId: a.org.id }, (tx) => tx.query("update listings set is_published = true where id = $1", [listing.id]));
    expect(await visible()).toHaveLength(1);
    // publishing a listing must not expose its physical units
    await withPublic(async (tx) => expect(await tx.query("select * from units where listing_id = $1", [listing.id])).toHaveLength(0));
  });
});

describe("role permissions", () => {
  it("restricts actions by role", async () => {
    const a = await makeOrg("Perm A");
    const { listing, units } = await makeListing(a.owner);
    const readonly = await addMember(a.org.id, "readonly");
    const tech = await addMember(a.org.id, "technician");
    const customer = await makeCustomer(a.owner);
    expect(await listUnits(readonly)).toHaveLength(1);
    await expect(createReservation(readonly, { customerId: customer.id, startsAt: d("2027-05-01T08:00:00Z"), endsAt: d("2027-05-02T08:00:00Z"), items: [{ listingId: listing.id, quantity: 1 }] })).rejects.toThrow(/auth.forbidden/);
    await expect(listCustomers(tech)).rejects.toThrow(/auth.forbidden/);
    await changeUnitStatus(tech, units[0].id, "maintenance", "service");
    expect((await getUnit(a.owner, units[0].id))!.unit.status).toBe("maintenance");
  });
});

describe("public marketplace", () => {
  it("exposes availability counts and provider identity only for published listings", async () => {
    const { publicAvailability, searchListings, getPublicListing } = await import("@/server/services/marketplace");
    const { createReservation } = await import("@/server/services/reservations");
    const a = await makeOrg("Tržnica A");
    const { listing } = await makeListing(a.owner, { units: 2, title: "Škarjasta dvižna ploščad" });
    expect(await publicAvailability(listing.id, d("2028-01-01T08:00:00Z"), d("2028-01-02T08:00:00Z"))).toBeNull();
    await withTenant({ orgId: a.org.id }, (tx) => tx.query("update listings set is_published = true where id = $1", [listing.id]));
    const c = await makeCustomer(a.owner);
    await createReservation(a.owner, { customerId: c.id, startsAt: d("2028-01-01T08:00:00Z"), endsAt: d("2028-01-03T08:00:00Z"), items: [{ listingId: listing.id, quantity: 1 }] });
    const av = await publicAvailability(listing.id, d("2028-01-01T08:00:00Z"), d("2028-01-02T08:00:00Z"));
    expect(av?.free).toBe(1);
    const found = await searchListings({ q: "dvižna" });
    expect(found.some((l) => l.id === listing.id)).toBe(true);
    const pub = await getPublicListing(a.org.slug, listing.slug);
    expect(pub?.provider_name).toBe("Tržnica A");
    expect(pub?.provider_city).toBe(null);
    // the platform-admin flag must not leak out of the definer function
    await withPublic(async (tx) => {
      await tx.query("select public_available_units($1, now(), now() + interval '1 day')", [listing.id]);
      expect(await tx.query("select * from units")).toHaveLength(0);
    });
  });
});

describe("members", () => {
  it("protects the last owner and limits who can change roles", async () => {
    const { changeMemberRole, listMembers } = await import("@/server/services/members");
    const a = await makeOrg("Člani");
    const mgr = await addMember(a.org.id, "manager");
    const rec = await addMember(a.org.id, "receptionist");
    await expect(changeMemberRole(a.owner, a.user.id, "manager")).rejects.toThrow(/members.lastOwner/);
    await expect(changeMemberRole(rec, mgr.userId, "readonly")).rejects.toThrow(/auth.forbidden/);
    await expect(changeMemberRole(mgr, rec.userId, "owner")).rejects.toThrow(/auth.forbidden/);
    await changeMemberRole(mgr, rec.userId, "warehouse");
    expect((await listMembers(a.owner)).find((m) => m.user_id === rec.userId)?.role).toBe("warehouse");
  });
});
