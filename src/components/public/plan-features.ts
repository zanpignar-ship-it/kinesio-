/**
 * Public labels for subscription plan feature codes (subscription_plans.features).
 * `live` is the honest rollout status shown on the pricing page.
 */
export const FEATURE_GROUPS: { title: string; rows: { code: string; label: string; live: boolean }[] }[] = [
  {
    title: "Vodenje izposojevalnice",
    rows: [
      { code: "inventory", label: "Inventar s fizičnimi enotami in inventarnimi številkami", live: true },
      { code: "calendar", label: "Koledar rezervacij brez dvojnih rezervacij", live: true },
      { code: "crm", label: "Stranke in zgodovina najemov", live: true },
      { code: "basic_reports", label: "Nadzorna plošča", live: true },
      { code: "basic_documents", label: "Osnovni dokumenti: ponudba in potrdilo rezervacije", live: false },
    ],
  },
  {
    title: "Oprema in potek najema",
    rows: [
      { code: "qr", label: "QR potni list za vsako enoto", live: true },
      { code: "passports", label: "Zgodovina enote v potnem listu: najemi, pregledi, servisi", live: false },
      { code: "pickup_return", label: "Prevzem in vračilo s pregledom stanja", live: false },
      { code: "agreements", label: "Digitalne najemne pogodbe", live: false },
      { code: "maintenance", label: "Servis in vzdrževanje", live: false },
      { code: "automations", label: "Samodejna obvestila in opomniki", live: false },
      { code: "online_payments", label: "Spletna plačila", live: false },
      { code: "advanced_reports", label: "Napredna poročila", live: false },
    ],
  },
  {
    title: "Za večja podjetja",
    rows: [
      { code: "multi_location", label: "Več poslovalnic", live: false },
      { code: "advanced_permissions", label: "Napredne pravice uporabnikov", live: false },
      { code: "advanced_finance", label: "Napredne finance", live: false },
      { code: "api", label: "API za povezavo z lastnimi sistemi", live: false },
      { code: "white_label", label: "Lastna blagovna znamka", live: false },
    ],
  },
];

export type PlanRow = {
  code: string;
  name: string;
  price_month_cents: number;
  price_year_cents: number;
  limits: { units?: number; locations?: number; members?: number };
  features: string[];
};

export const PLAN_COPY: Record<string, { blurb: string; highlights: { label: string; live: boolean }[] }> = {
  basic: {
    blurb: "Za manjše izposojevalnice, ki prehajajo s tabel na digitalno evidenco.",
    highlights: [
      { label: "Inventar s fizičnimi enotami", live: true },
      { label: "Koledar brez dvojnih rezervacij", live: true },
      { label: "Stranke in nadzorna plošča", live: true },
      { label: "Objava opreme na tržnici", live: true },
    ],
  },
  pro: {
    blurb: "Za ekipe, ki želijo celoten potek najema na enem mestu.",
    highlights: [
      { label: "Neomejeno število enot", live: true },
      { label: "QR potni list za vsako enoto", live: true },
      { label: "Digitalne pogodbe", live: false },
      { label: "Prevzem, vračilo in servis", live: false },
      { label: "Spletna plačila in avtomatizacije", live: false },
    ],
  },
  enterprise: {
    blurb: "Za podjetja z več poslovalnicami in lastnimi poslovnimi sistemi.",
    highlights: [
      { label: "Vse iz paketa Pro", live: true },
      { label: "Več poslovalnic", live: false },
      { label: "Napredne pravice uporabnikov", live: false },
      { label: "API in lastna blagovna znamka", live: false },
    ],
  },
};

/** Pro and Enterprise have technical safety caps in the DB, not commercial limits. */
export function unitsLimitLabel(units?: number) {
  if (!units || units >= 1000) return "Neomejeno enot";
  return `Do ${units} enot`;
}
export function membersLimitLabel(n?: number) {
  if (!n || n >= 100) return "Neomejeno uporabnikov";
  return `Do ${n} ${n % 100 >= 3 && n % 100 <= 4 ? "uporabniki" : n % 100 === 2 ? "uporabnika" : n % 100 === 1 ? "uporabnik" : "uporabnikov"}`;
}
export function locationsLimitLabel(n?: number) {
  if (!n || n >= 50) return "Več poslovalnic";
  if (n === 1) return "1 poslovalnica";
  return `Do ${n} ${n % 100 === 2 ? "poslovalnici" : n % 100 <= 4 && n % 100 >= 3 ? "poslovalnice" : "poslovalnic"}`;
}
