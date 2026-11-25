import { defineMachine } from "./state-machine";

export const UNIT_STATUSES = [
  "available", "reserved", "awaiting_pickup", "rented", "awaiting_return", "overdue",
  "inspection", "damaged", "maintenance", "unavailable", "retired",
] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/**
 * Operational (physical) status of a unit right now. Future bookings are
 * represented by allocations, not by this status.
 */
export const unitMachine = defineMachine<UnitStatus>("unit", {
  available: ["reserved", "awaiting_pickup", "rented", "inspection", "maintenance", "unavailable", "damaged", "retired"],
  reserved: ["available", "awaiting_pickup", "rented"],
  awaiting_pickup: ["rented", "available", "reserved"],
  rented: ["awaiting_return", "overdue", "inspection"],
  awaiting_return: ["inspection", "overdue"],
  overdue: ["inspection"],
  inspection: ["available", "damaged", "maintenance"],
  damaged: ["maintenance", "inspection", "retired"],
  maintenance: ["inspection", "available", "retired"],
  unavailable: ["available", "maintenance", "retired"],
  retired: [],
});

/** Units in these statuses cannot receive new allocations. */
export const NON_BOOKABLE: ReadonlySet<UnitStatus> = new Set(["retired", "unavailable", "damaged"]);
