/** Slovenian plural forms: [1, 2, 3–4, 0 and 5+]. */
export function plural(n: number, forms: [string, string, string, string]) {
  const m = Math.abs(n) % 100;
  if (m === 1) return forms[0];
  if (m === 2) return forms[1];
  if (m === 3 || m === 4) return forms[2];
  return forms[3];
}

export const listingsWord = (n: number) => `${n} ${plural(n, ["oglas", "oglasa", "oglasi", "oglasov"])}`;
export const unitsWord = (n: number) => `${n} ${plural(n, ["enota", "enoti", "enote", "enot"])}`;
export const daysWord = (n: number) => `${n} ${plural(n, ["dan", "dneva", "dnevi", "dni"])}`;
export const resultsWord = (n: number) => `${n} ${plural(n, ["rezultat", "rezultata", "rezultati", "rezultatov"])}`;

export function categoryName(name: Record<string, string> | null | undefined, fallback = "Oprema") {
  return name?.sl ?? name?.en ?? fallback;
}

export const container = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

export const SITE_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
