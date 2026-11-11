import JSZip from 'jszip';
import { toCsv } from './csv';

export type ArchiveInput = {
  organizationName: string;
  generatedAt: string;
  plots: (Record<string, unknown> & { geom: unknown })[];
  tables: Record<string, Record<string, unknown>[]>;
  files: { path: string; data: Uint8Array }[];
};

const columnsOf = (rows: Record<string, unknown>[]) => [...new Set(rows.flatMap((r) => Object.keys(r)))];

/** ZIP for inspections: all plots as GeoJSON + CSV, every table as CSV, stored files, and a short readme. */
export async function buildArchive(input: ArchiveInput): Promise<Uint8Array> {
  const zip = new JSZip();
  const features = input.plots.map(({ geom, ...props }) => ({ type: 'Feature', properties: props, geometry: geom ?? null }));
  zip.file('plots.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
  const plotRows = input.plots.map(({ geom, ...props }) => ({ ...props, geometry: geom ?? null }));
  zip.file('plots.csv', toCsv(plotRows, columnsOf(plotRows)));
  for (const [name, rows] of Object.entries(input.tables)) zip.file(`${name}.csv`, toCsv(rows, rows.length ? columnsOf(rows) : ['id']));
  for (const f of input.files) zip.file(`files/${f.path}`, f.data);
  zip.file(
    'README.txt',
    [
      `LesTrace – ${input.organizationName}`,
      `Generated: ${input.generatedAt}`,
      '',
      'plots.geojson  all plots (WGS-84)',
      '*.csv          tables (semicolon separated, UTF-8)',
      'files/         uploaded documents and original import files',
      '',
      'Keep this archive for at least 5 years (EUDR).',
    ].join('\r\n'),
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
