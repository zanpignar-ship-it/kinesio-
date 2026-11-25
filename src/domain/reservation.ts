import { defineMachine } from "./state-machine";

export const RESERVATION_STATUSES = [
  "draft", "quotation", "awaiting_confirmation", "confirmed", "awaiting_pickup", "active",
  "awaiting_return", "inspection", "completed", "cancelled", "expired", "overdue", "disputed", "refunded",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const reservationMachine = defineMachine<ReservationStatus>("reservation", {
  draft: ["quotation", "awaiting_confirmation", "confirmed", "cancelled"],
  quotation: ["awaiting_confirmation", "confirmed", "expired", "cancelled"],
  awaiting_confirmation: ["confirmed", "cancelled", "expired"],
  confirmed: ["awaiting_pickup", "active", "cancelled"],
  awaiting_pickup: ["active", "cancelled"],
  active: ["awaiting_return", "overdue", "inspection"],
  awaiting_return: ["inspection", "overdue"],
  overdue: ["inspection", "disputed"],
  inspection: ["completed", "disputed"],
  disputed: ["completed", "refunded"],
  completed: ["disputed", "refunded"],
  cancelled: [],
  expired: [],
  refunded: [],
});

/** Statuses in which allocated units stay blocked in the calendar. */
export const BLOCKING_STATUSES: ReadonlySet<ReservationStatus> = new Set([
  "draft", "quotation", "awaiting_confirmation", "confirmed", "awaiting_pickup", "active",
  "awaiting_return", "overdue", "inspection", "disputed",
]);

/** Transitions that release the units (allocations become inactive). */
export function releasesAllocations(to: ReservationStatus) {
  return to === "cancelled" || to === "expired";
}

export const RESERVATION_SOURCES = [
  "marketplace", "direct", "phone", "walk_in", "provider_website", "existing_customer", "referral", "api",
] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

/** Only marketplace-acquired reservations are commissionable. */
export function isCommissionable(source: ReservationSource) {
  return source === "marketplace";
}
