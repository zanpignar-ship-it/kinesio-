import JSZip from 'jszip';
import { parseDbf, parseShp } from 'shpjs';
import { decimalStatsFromNumbers } from '../precision';
import { failed, finalize, type FinalizeOptions, type ParseResult, type RawFeature } from './common';

function find(zip: JSZip, ext: string): JSZip.JSZipObject | null {
  const name = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(ext) && !n.startsWith('__MACOSX'));
  return name ? zip.file(name) : null;
}

export async function parseShapefileZip(data: Uint8Array, opts: FinalizeOptions = {}): Promise<ParseResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return failed();
  }
  const shp = find(zip, '.shp');
  if (!shp) return failed();
  const dbf = find(zip, '.dbf');
  const prj = find(zip, '.prj');
  const cpg = find(zip, '.cpg');

  let geometries;
  let props: (Record<string, unknown> | null)[] = [];
  try {
    // Parse without .prj so shpjs does not reproject; we handle the CRS ourselves.
    geometries = parseShp(await shp.async('uint8array'));
    if (dbf) props = parseDbf(await dbf.async('uint8array'), cpg ? await cpg.async('string') : undefined);
  } catch {
    return failed();
  }
  const raw: RawFeature[] = geometries.map((geometry, i) => ({
    geometry,
    properties: { ...(props[i] ?? {}) },
    decimals: decimalStatsFromNumbers(geometry),
  }));
  return finalize(raw, prj ? await prj.async('string') : null, [], opts);
}
