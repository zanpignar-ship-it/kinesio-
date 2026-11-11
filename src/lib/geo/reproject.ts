import proj4 from 'proj4';
import type * as GeoJSON from 'geojson';
import { allPositions, mapPositions } from './coords';
import type { Issue } from './types';

export type SupportedCrs =
  | 'EPSG:4326'
  | 'EPSG:3794'
  | 'EPSG:3912'
  | 'EPSG:3765'
  | 'EPSG:3908'
  | 'EPSG:3909'
  | 'EPSG:31276'
  | 'EPSG:31277'
  | 'EPSG:32633'
  | 'EPSG:32634';

/**
 * proj4 definitions. Datum shifts follow PROJ's default (most accurate) transformation,
 * converted to the position-vector convention used by +towgs84.
 * EPSG:3912 (D48/GK, MGI 1901): EPSG transformation "MGI 1901 to WGS 84 (16)", ~1 m.
 * Balkans zones (EPSG:3908/3909, and the deprecated 31276/31277 with the same projection):
 * the datum shift depends on the country – BiH: EPSG "MGI 1901 to WGS 84 (4)", Serbia: "(15)", ~1 m.
 * TODO: preveri, ali je za D48/GK potrebna transformacija z mrežo virtualnih točk GURS (natančnost < 1 m).
 * TODO: preveri transformacijo za stare hrvaške podatke v Besselovih conah (HDKS).
 */
type BalkansCrs = 'EPSG:3908' | 'EPSG:3909' | 'EPSG:31276' | 'EPSG:31277';

const BALKANS_PROJ: Record<BalkansCrs, string> = {
  'EPSG:3908': '+proj=tmerc +lat_0=0 +lon_0=18 +k=0.9999 +x_0=6500000 +y_0=0 +ellps=bessel +units=m +no_defs',
  'EPSG:31276': '+proj=tmerc +lat_0=0 +lon_0=18 +k=0.9999 +x_0=6500000 +y_0=0 +ellps=bessel +units=m +no_defs',
  'EPSG:3909': '+proj=tmerc +lat_0=0 +lon_0=21 +k=0.9999 +x_0=7500000 +y_0=0 +ellps=bessel +units=m +no_defs',
  'EPSG:31277': '+proj=tmerc +lat_0=0 +lon_0=21 +k=0.9999 +x_0=7500000 +y_0=0 +ellps=bessel +units=m +no_defs',
};

/** +towgs84 (position vector) per country for MGI 1901. */
const MGI_1901_TOWGS84: Record<'BA' | 'RS', string> = {
  BA: '551.7,162.9,467.9,6.04,1.96,-11.38,-4.82',
  RS: '577.84843,165.45019,390.43652,4.93131,-0.96052,-13.05072,7.86546',
};

const DEFS: Record<Exclude<SupportedCrs, 'EPSG:4326' | BalkansCrs>, string> = {
  'EPSG:3794': '+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9999 +x_0=500000 +y_0=-5000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  'EPSG:3912':
    '+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9999 +x_0=500000 +y_0=-5000000 +ellps=bessel +towgs84=476.08,125.947,417.81,4.610862,2.388137,-11.942335,9.896638 +units=m +no_defs',
  'EPSG:3765': '+proj=tmerc +lat_0=0 +lon_0=16.5 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  'EPSG:32633': '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs',
  'EPSG:32634': '+proj=utm +zone=34 +datum=WGS84 +units=m +no_defs',
};

const SUPPORTED: readonly SupportedCrs[] = [
  'EPSG:4326',
  ...(Object.keys(DEFS) as SupportedCrs[]),
  ...(Object.keys(BALKANS_PROJ) as SupportedCrs[]),
];

function isBalkans(crs: SupportedCrs): crs is BalkansCrs {
  return crs in BALKANS_PROJ;
}

/** Rough split between BiH and Serbia for MGI 1901 data without a country hint. */
function looksSerbian(lon: number, lat: number): boolean {
  return lon >= 19.62 || (lat >= 45.28 && lon >= 18.8);
}

export function parseCrsHint(hint: string): SupportedCrs | null {
  const epsg = /EPSG:{1,2}(\d+)/i.exec(hint);
  if (epsg) {
    const code = `EPSG:${epsg[1]}` as SupportedCrs;
    return SUPPORTED.includes(code) ? code : null;
  }
  const s = hint.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.includes('CRS84')) return 'EPSG:4326';
  if (s.includes('D48') || (s.includes('MGI') && s.includes('SLOVEN'))) return 'EPSG:3912';
  if (s.includes('D96') || s.includes('SLOVENIA1996')) return 'EPSG:3794';
  if (s.includes('HTRS96')) return 'EPSG:3765';
  const mgi1901 = s.includes('1901');
  if (s.includes('BALKANS6') || s.includes('BALKANSZONE6')) return mgi1901 ? 'EPSG:3908' : 'EPSG:31276';
  if (s.includes('BALKANS7') || s.includes('BALKANSZONE7')) return mgi1901 ? 'EPSG:3909' : 'EPSG:31277';
  if (s.includes('UTMZONE33N')) return 'EPSG:32633';
  if (s.includes('UTMZONE34N')) return 'EPSG:32634';
  if (!s.startsWith('PROJCS') && (s.includes('WGS1984') || s.includes('WGS84'))) return 'EPSG:4326';
  return null;
}

/**
 * Guess the CRS of a geometry without metadata. Degrees → WGS-84; metres inside the
 * Slovenian D96/TM extent → EPSG:3794 (must be confirmed by the user); otherwise CRS_UNKNOWN.
 * With CRS_UNKNOWN the returned crs is EPSG:4326 and the coordinates stay as they are
 * (validation then reports COORD_LOOKS_PROJECTED).
 */
export function guessCrs(geometry: GeoJSON.Geometry): { crs: SupportedCrs; issue: Issue | null } {
  const positions = allPositions(geometry);
  const inDegrees = positions.every(([x = 0, y = 0]) => Math.abs(x) <= 180 && Math.abs(y) <= 90);
  if (inDegrees) return { crs: 'EPSG:4326', issue: null };
  const inD96 = positions.every(([x = 0, y = 0]) => x >= 370_000 && x <= 630_000 && y >= 20_000 && y <= 200_000);
  if (inD96) return { crs: 'EPSG:3794', issue: { code: 'CRS_GUESSED', severity: 'warning', params: { crs: 'EPSG:3794' } } };
  return { crs: 'EPSG:4326', issue: { code: 'CRS_UNKNOWN', severity: 'error' } };
}

const round8 = (v: number): number => Math.round(v * 1e8) / 1e8;

function definitionFor(from: Exclude<SupportedCrs, 'EPSG:4326'>, geometry: GeoJSON.Geometry, country: string | undefined): string {
  if (!isBalkans(from)) return DEFS[from];
  let datum: 'BA' | 'RS';
  if (country === 'BA' || country === 'RS') {
    datum = country;
  } else {
    const [x = 0, y = 0] = allPositions(geometry)[0] ?? [];
    const [lon = 0, lat = 0] = proj4(BALKANS_PROJ[from], 'WGS84').forward([x, y]);
    datum = looksSerbian(lon, lat) ? 'RS' : 'BA';
  }
  return `${BALKANS_PROJ[from]} +towgs84=${MGI_1901_TOWGS84[datum]}`;
}

export function toWgs84<G extends GeoJSON.Geometry>(geometry: G, from: SupportedCrs, opts: { country?: string } = {}): G {
  if (from === 'EPSG:4326') return geometry;
  const converter = proj4(definitionFor(from, geometry, opts.country), 'WGS84');
  return mapPositions(geometry, (p) => {
    const [lon, lat] = converter.forward([p[0] ?? 0, p[1] ?? 0]);
    return p.length > 2 ? [round8(lon ?? 0), round8(lat ?? 0), ...p.slice(2)] : [round8(lon ?? 0), round8(lat ?? 0)];
  });
}
