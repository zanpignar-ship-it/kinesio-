import { describe, expect, it } from "vitest";
import { billableDays, quote, applyDiscount } from "@/domain/pricing";
import { reservationMachine, isCommissionable } from "@/domain/reservation";
import { unitMachine } from "@/domain/unit";
import { can } from "@/domain/permissions";
import { parseMoneyToCents } from "@/domain/money";
import { generateCodes } from "@/server/services/inventory";

describe("pricing", () => {
  const p = { dayCents: 3000, weekCents: 15000, monthCents: 45000 };
  it("counts every started 24h as a day", () => {
    const s = new Date("2026-05-01T08:00:00Z");
    expect(billableDays(s, new Date("2026-05-01T17:00:00Z"))).toBe(1);
    expect(billableDays(s, new Date("2026-05-02T08:00:00Z"))).toBe(1);
    expect(billableDays(s, new Date("2026-05-02T08:01:00Z"))).toBe(2);
    expect(() => billableDays(s, s)).toThrow();
  });
  it("chooses the cheapest rate combination", () => {
    expect(quote(p, 3).totalCents).toBe(9000);
    expect(quote(p, 6)).toMatchObject({ totalCents: 15000, breakdown: { weeks: 1, days: 0 } }); // week cheaper than 6 days
    expect(quote(p, 8)).toMatchObject({ totalCents: 18000, breakdown: { weeks: 1, days: 1 } });
    expect(quote(p, 30).totalCents).toBe(45000);
    expect(quote({ dayCents: 1000 }, 10).totalCents).toBe(10000);
  });
  it("applies discounts in whole cents", () => {
    expect(applyDiscount(9999, 10)).toEqual({ discountCents: 1000, totalCents: 8999 });
  });
  it("parses Slovenian money input", () => {
    expect(parseMoneyToCents("1.234,56")).toBe(123456);
    expect(parseMoneyToCents("49")).toBe(4900);
    expect(parseMoneyToCents("12.5")).toBe(1250);
    expect(parseMoneyToCents("abc")).toBeNull();
  });
});

describe("reservation state machine", () => {
  it("follows the rental lifecycle", () => {
    const path = ["draft", "quotation", "awaiting_confirmation", "confirmed", "awaiting_pickup", "active", "awaiting_return", "inspection", "completed"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(reservationMachine.canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("rejects invalid transitions", () => {
    expect(reservationMachine.canTransition("completed", "active")).toBe(false);
    expect(reservationMachine.canTransition("active", "cancelled")).toBe(false);
    expect(reservationMachine.canTransition("active", "completed")).toBe(false);
    expect(() => reservationMachine.assert("cancelled", "confirmed")).toThrow(/Invalid reservation transition/);
    expect(reservationMachine.isTerminal("cancelled")).toBe(true);
  });
  it("only marketplace bookings are commissionable", () => {
    expect(isCommissionable("marketplace")).toBe(true);
    for (const s of ["direct", "phone", "walk_in", "provider_website", "existing_customer", "referral", "api"] as const) expect(isCommissionable(s)).toBe(false);
  });
});

describe("unit state machine", () => {
  it("prevents physically impossible transitions", () => {
    expect(unitMachine.canTransition("rented", "available")).toBe(false); // must be inspected first
    expect(unitMachine.canTransition("retired", "available")).toBe(false);
    expect(unitMachine.canTransition("inspection", "available")).toBe(true);
    expect(unitMachine.canTransition("damaged", "maintenance")).toBe(true);
  });
});

describe("permissions", () => {
  it("maps roles to capabilities", () => {
    expect(can("owner", "billing.manage")).toBe(true);
    expect(can("manager", "billing.manage")).toBe(false);
    expect(can("readonly", "reservations.write")).toBe(false);
    expect(can("technician", "maintenance.write")).toBe(true);
    expect(can("receptionist", "inventory.write")).toBe(false);
    expect(can("accountant", "finance.read")).toBe(true);
  });
});

describe("inventory codes", () => {
  it("generates sequential padded codes", () => {
    expect(generateCodes("mkt-hm", 4, 2)).toEqual(["MKT-HM-004", "MKT-HM-005"]);
  });
});
