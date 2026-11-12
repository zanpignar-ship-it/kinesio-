import type { SupportedCrs } from '../reproject';
import { failed, type ParseResult } from './common';
import { parseCsv } from './csv';
import { parseGeoJson } from './geojson';
import { parseKml, parseKmz } from './kml';
import { parseShapefileZip } from './shapefile';
import { xlsxToCsv } from './xlsx';

export type { ParseResult } from './common';

/** UTF-8, or Windows-1250 (Slovenian/Croatian Excel "CSV") when the bytes are not valid UTF-8. */
function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    return new TextDecoder('windows-1250').decode(data);
  }
}

/** Parse an uploaded plot file by its extension. Geometries come back in WGS-84. */
export interface ParseOptions {
  /** CRS confirmed by the user; overrides metadata and guessing. */
  crs?: SupportedCrs;
}

export async function parsePlotFile(fileName: string, data: Uint8Array, opts: ParseOptions = {}): Promise<ParseResult> {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'geojson':
    case 'json':
      return parseGeoJson(decodeText(data), opts);
    case 'kml':
      return parseKml(decodeText(data), opts);
    case 'kmz':
      return parseKmz(data, opts);
    case 'zip':
      return parseShapefileZip(data, opts);
    case 'csv':
    case 'txt':
      return parseCsv(decodeText(data), opts);
    case 'xlsx':
      try {
        return parseCsv(await xlsxToCsv(data), opts);
      } catch {
        return failed({ extension: ext });
      }
    default:
      return failed({ extension: ext });
  }
}
