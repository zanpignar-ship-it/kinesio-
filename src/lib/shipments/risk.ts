export type RiskLevel = 'low' | 'standard' | 'high';

/** Country risk per Implementing Regulation (EU) 2025/1093: listed low/high, everything else standard (art. 29). */
export function countryRisk(country: string | null, listed: { country: string; risk: RiskLevel }[]): RiskLevel | null {
  if (!country) return null;
  return listed.find((c) => c.country === country)?.risk ?? 'standard';
}

/**
 * Low risk: simplified due diligence (art. 13) – no risk assessment needed, unless the operator knows of a risk.
 * Standard/high risk: a documented assessment concluding negligible risk is required before placing on the market.
 */
export function needsRiskAssessment(level: RiskLevel | null): boolean {
  return level === 'standard' || level === 'high';
}
