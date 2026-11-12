export type DdsInput = {
  activity: 'domestic' | 'import' | 'export';
  operator: { name: string; country: string; eori: string | null; taxId: string | null };
  internalRef: string;
  countryOfProduction: string | null;
  plotCount: number;
  productionPeriod?: string | null;
  items: { hsCode: string; description: string; tradeName: string | null; scientificName: string | null; commonName: string | null; netMassKg: number | null; volumeM3: number | null; pieces: number | null }[];
  references: { kind: 'dds' | 'simplified_declaration'; referenceNo: string; verificationNo: string | null }[];
};

export type DdsField = { key: string; value: string; item?: number };

/** Earliest start and latest end of the plots' harvest dates ("2026-01-10 – 2026-03-31"), or null when none is known. */
export function productionPeriod(plots: { harvestFrom: string | null; harvestTo: string | null }[]): string | null {
  const starts = plots.map((p) => p.harvestFrom ?? p.harvestTo).filter((d): d is string => Boolean(d)).sort();
  const ends = plots.map((p) => p.harvestTo ?? p.harvestFrom).filter((d): d is string => Boolean(d)).sort();
  if (!starts.length) return null;
  const from = starts[0]!;
  const to = ends[ends.length - 1]!;
  return from === to ? from : `${from} – ${to}`;
}

/**
 * Fields of the due diligence statement in the order they are entered in TRACES.
 * TODO: preveri celoten seznam polj v EUDR API V3 (DueDiligenceStatementBaseType).
 */
export function ddsSummary(d: DdsInput): DdsField[] {
  const fields: DdsField[] = [
    { key: 'activity', value: d.activity },
    { key: 'operatorName', value: d.operator.name },
    { key: 'operatorCountry', value: d.operator.country },
  ];
  const id = d.operator.eori ?? d.operator.taxId;
  if (id) fields.push({ key: 'operatorId', value: id });
  fields.push({ key: 'internalRef', value: d.internalRef });
  d.items.forEach((i, n) => {
    const item = d.items.length > 1 ? n + 1 : undefined;
    const add = (key: string, value: string | number | null) => {
      if (value !== null && value !== '') fields.push(item ? { key, value: String(value), item } : { key, value: String(value) });
    };
    add('hsCode', i.hsCode);
    add('description', i.description);
    add('tradeName', i.tradeName);
    add('scientificName', i.scientificName);
    add('commonName', i.commonName);
    add('netMassKg', i.netMassKg);
    add('volumeM3', i.volumeM3);
    add('supplementaryUnits', i.pieces);
  });
  if (d.countryOfProduction) fields.push({ key: 'countryOfProduction', value: d.countryOfProduction });
  if (d.productionPeriod) fields.push({ key: 'productionPeriod', value: d.productionPeriod });
  if (d.plotCount > 0) fields.push({ key: 'geolocation', value: String(d.plotCount) });
  if (d.references.length) {
    fields.push({ key: 'references', value: d.references.map((r) => (r.verificationNo ? `${r.referenceNo} / ${r.verificationNo}` : r.referenceNo)).join('; ') });
  }
  return fields;
}
