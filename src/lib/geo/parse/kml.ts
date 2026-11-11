import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { countDecimals, decimalStatsFromNumbers } from '../precision';
import type { DecimalStats } from '../types';
import { failed, finalize, type FinalizeOptions, type ParseResult, type RawFeature } from './common';

/** Decimals of lon/lat as written in the <coordinates> of one Placemark. */
function placemarkDecimals(placemark: Element): DecimalStats | null {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  const nodes = placemark.getElementsByTagName('coordinates');
  for (let i = 0; i < nodes.length; i++) {
    const tuples = (nodes.item(i)?.textContent ?? '').trim().split(/\s+/).filter(Boolean);
    for (const tuple of tuples) {
      for (const v of tuple.split(',').slice(0, 2)) {
        const d = countDecimals(v);
        min = Math.min(min, d);
        max = Math.max(max, d);
      }
    }
  }
  return Number.isFinite(min) ? { min, max } : null;
}

export function parseKml(text: string, opts: FinalizeOptions = {}): ParseResult {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, 'text/xml') as unknown as Document;
  } catch {
    return failed();
  }
  const fc = kml(doc);
  const placemarks = doc.getElementsByTagName('Placemark');
  const sameOrder = placemarks.length === fc.features.length;
  const raw: RawFeature[] = fc.features.map((f, i) => {
    const pm = sameOrder ? placemarks.item(i) : null;
    return {
      geometry: f.geometry ?? null,
      properties: { ...(f.properties ?? {}) },
      decimals: pm ? placemarkDecimals(pm) : f.geometry ? decimalStatsFromNumbers(f.geometry) : null,
    };
  });
  // KML is always WGS-84 by definition.
  return finalize(raw, 'EPSG:4326', [], opts);
}

export async function parseKmz(data: Uint8Array, opts: FinalizeOptions = {}): Promise<ParseResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return failed();
  }
  const names = Object.keys(zip.files).filter((n) => n.toLowerCase().endsWith('.kml'));
  const name = names.find((n) => n.toLowerCase().endsWith('doc.kml')) ?? names[0];
  const file = name ? zip.file(name) : null;
  if (!file) return failed();
  return parseKml(await file.async('string'), opts);
}
