export function formatMoney(cents: number, currency = "EUR", locale = "sl-SI") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Parses "1.234,56" / "1234.56" / "49" into integer cents. Returns null when invalid. */
export function parseMoneyToCents(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, "");
  if (!s) return null;
  let normalized = s;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
