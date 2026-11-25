import type { MessageKey } from "./sl";

/** English. Missing keys fall back to Slovenian. German and Croatian follow the same pattern. */
export const en: Partial<Record<MessageKey, string>> = {
  "nav.dashboard": "Overview",
  "nav.calendar": "Calendar",
  "nav.reservations": "Reservations",
  "nav.inventory": "Equipment",
  "nav.units": "Units",
  "nav.customers": "Customers",
  "nav.scan": "Scan",
  "nav.settings": "Settings",
  "nav.logout": "Sign out",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "auth.invalidCredentials": "Email or password is incorrect.",
  "reservation.conflict": "The period overlaps an existing booking or maintenance block.",
  "rs.confirmed": "Confirmed",
  "rs.active": "On rent",
  "us.available": "Available",
  "us.rented": "On rent",
};
