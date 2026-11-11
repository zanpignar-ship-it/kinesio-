import { failed, type ParseResult } from './common';
import { parseCsv } from './csv';
import { parseGeoJson } from './geojson';
import { parseKml, parseKmz } from './kml';
import { parseShapefileZip } from './shapefile';

export type { ParseResult } from './common';

const utf8 = (data: Uint8Array): string => new TextDecoder('utf-8').decode(data);

/** Parse an uploaded plot file by its extension. Geometries come back in WGS-84. */
export async function parsePlotFile(fileName: string, data: Uint8Array): Promise<ParseResult> {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'geojson':
    case 'json':
      return parseGeoJson(utf8(data));
    case 'kml':
      return parseKml(utf8(data));
    case 'kmz':
      return parseKmz(data);
    case 'zip':
      return parseShapefileZip(data);
    case 'csv':
    case 'txt':
      return parseCsv(utf8(data));
    default:
      return failed({ extension: ext });
  }
}
