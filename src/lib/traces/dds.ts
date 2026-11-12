import { buildEudrGeoJson, type ExportPlot } from '@/lib/geo/export-eudr';
import { el, esc } from './xml';

export type DdsActivity = 'DOMESTIC' | 'IMPORT' | 'EXPORT';

export type DdsCommodityInput = {
  description: string;
  hsCode: string;
  netMassKg: number | null;
  volumeM3: number | null;
  pieces: number | null;
  scientificName: string | null;
  commonName: string | null;
};

export type DdsInput = {
  internalRef: string;
  activity: DdsActivity;
  /** EU member state of the activity (operator's country); left out for operators outside the EU. */
  countryOfActivity: string | null;
  geoLocationConfidential: boolean;
  commodities: DdsCommodityInput[];
  /** Plots of the shipment; producers are grouped by producer name and country. */
  plots: ExportPlot[];
};

export type DdsProblem = 'noCommodities' | 'noPlots' | 'speciesNames' | 'netMass' | 'quantity' | 'tooManyProducers' | 'hsCode';

const EU = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);
export const isEuCountry = (c: string | null | undefined): boolean => Boolean(c && EU.has(c.toUpperCase()));

/** Supplementary unit codes (CN): MTQ = m³, NAR = number of items. TODO: preveri dovoljene kode v XSD. */
const UNIT_M3 = 'MTQ';
const UNIT_PIECES = 'NAR';

/** Producers: one per (name, country), each with the GeoJSON FeatureCollection of its plots. */
export function groupProducers(plots: ExportPlot[]): { name: string | null; country: string; plots: ExportPlot[] }[] {
  const groups = new Map<string, { name: string | null; country: string; plots: ExportPlot[] }>();
  for (const p of plots) {
    const country = (p.producerCountry ?? '').toUpperCase();
    const name = p.producerName ?? null;
    const key = `${country}|${name ?? ''}`;
    const g = groups.get(key) ?? { name, country, plots: [] };
    g.plots.push(p);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Rules the Information System enforces, checked before sending (validation rules page of the API docs). */
export function checkDds(input: DdsInput): DdsProblem[] {
  const out = new Set<DdsProblem>();
  if (input.commodities.length === 0) out.add('noCommodities');
  if (input.plots.length === 0) out.add('noPlots');
  for (const c of input.commodities) {
    if (!c.scientificName || !c.commonName) out.add('speciesNames');
    if (input.activity !== 'DOMESTIC' && !(c.netMassKg && c.netMassKg > 0)) out.add('netMass');
    if (!c.netMassKg && !c.volumeM3 && !c.pieces) out.add('quantity');
    if (!/^[0-9]{2,10}$/.test(c.hsCode)) out.add('hsCode');
  }
  if (groupProducers(input.plots).length > 1000) out.add('tooManyProducers');
  return [...out];
}

const num = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** Body of SubmitDdsRequest (V4). Every commodity carries all producers of the shipment. */
export function submitDdsBody(input: DdsInput): string {
  const producers = groupProducers(input.plots).map((g, i) => {
    const geojson = Buffer.from(JSON.stringify(buildEudrGeoJson(g.plots)), 'utf8').toString('base64');
    return (
      `<dds:producers>` +
      el('dds:position', i + 1) +
      el('dds:country', g.country) +
      el('dds:name', g.name?.slice(0, 500)) +
      (input.geoLocationConfidential ? '' : `<dds:geometryGeojson>${geojson}</dds:geometryGeojson>`) +
      `</dds:producers>`
    );
  });
  const commodities = input.commodities.map((c, i) => {
    const supplementary =
      c.volumeM3 ? el('eudrCommon:supplementaryUnit', num(c.volumeM3)) + el('eudrCommon:supplementaryUnitQualifier', UNIT_M3)
      : c.pieces ? el('eudrCommon:supplementaryUnit', c.pieces) + el('eudrCommon:supplementaryUnitQualifier', UNIT_PIECES)
      : '';
    return (
      `<dds:commodities>` +
      el('dds:position', i + 1) +
      `<dds:descriptors>` +
      el('eudrCommon:descriptionOfGoods', c.description.slice(0, 150)) +
      `<eudrCommon:goodsMeasure>${c.netMassKg ? el('eudrCommon:netWeight', num(c.netMassKg)) : ''}${supplementary}</eudrCommon:goodsMeasure>` +
      `</dds:descriptors>` +
      el('dds:hsHeading', c.hsCode) +
      (c.scientificName || c.commonName ? `<dds:speciesInfo>${el('dds:scientificName', c.scientificName)}${el('dds:commonName', c.commonName)}</dds:speciesInfo>` : '') +
      producers.join('') +
      `</dds:commodities>`
    );
  });
  return (
    `<dds:SubmitDdsRequest>` +
    `<dds:operatorRole>OPERATOR</dds:operatorRole>` +
    `<dds:statement>` +
    el('dds:internalReferenceNumber', input.internalRef.slice(0, 50)) +
    `<dds:activityType>${esc(input.activity)}</dds:activityType>` +
    (isEuCountry(input.countryOfActivity) ? el('dds:countryOfActivity', input.countryOfActivity!.toUpperCase()) : '') +
    commodities.join('') +
    `<dds:geoLocationConfidential>${input.geoLocationConfidential ? 'true' : 'false'}</dds:geoLocationConfidential>` +
    `</dds:statement>` +
    `</dds:SubmitDdsRequest>`
  );
}

export const getDdsBody = (uuids: string[]) => `<dds:GetDdsRequest>${uuids.map((u) => el('dds:uuidList', u)).join('')}</dds:GetDdsRequest>`;
export const withdrawDdsBody = (uuid: string) => `<dds:WithdrawDdsRequest>${el('dds:uuid', uuid)}</dds:WithdrawDdsRequest>`;
export const echoBody = (query: string) => `<echo:EudrEchoRequest>${el('echo:query', query)}</echo:EudrEchoRequest>`;
