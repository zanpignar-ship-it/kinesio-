export type RiskLevel = 'low' | 'standard' | 'high';

/** Country risk per Implementing Regulation (EU) 2025/1093: listed low/high, everything else standard (art. 29). */
export function countryRisk(country: string | null, listed: { country: string; risk: RiskLevel }[]): RiskLevel | null {
  if (!country) return null;
  return listed.find((c) => c.country === country)?.risk ?? 'standard';
}

const ORDER: RiskLevel[] = ['low', 'standard', 'high'];

/** Highest risk over all countries of production (shipment country and every plot's country). */
export function shipmentRisk(countries: (string | null)[], listed: { country: string; risk: RiskLevel }[]): RiskLevel | null {
  const levels = [...new Set(countries.filter((c): c is string => Boolean(c)))].map((c) => countryRisk(c, listed)!);
  if (!levels.length) return null;
  return levels.reduce((a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a));
}

/**
 * Low risk: simplified due diligence (art. 13) – no risk assessment needed, unless the operator knows of a risk.
 * Standard/high risk: a documented assessment concluding negligible risk is required before placing on the market.
 */
export function needsRiskAssessment(level: RiskLevel | null): boolean {
  return level === 'standard' || level === 'high';
}
