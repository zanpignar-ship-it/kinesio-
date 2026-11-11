/**
 * Try a plot file without the web app:
 *   npx tsx scripts/try-file.ts <datoteka> [--country SI]
 * Prints the validation result per plot (in Slovenian) and writes out.geojson for TRACES.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import sl from '../messages/sl.json';
import { buildEudrGeoJson, serializeEudrGeoJson, type ExportPlot } from '../src/lib/geo/export-eudr';
import { parsePlotFile } from '../src/lib/geo/parse';
import type { Issue } from '../src/lib/geo/types';
import { validatePlot } from '../src/lib/geo/validate';

const messages: Record<string, string> = sl.geo.issues;
const ICON = { valid: '✅', warning: '⚠️ ', error: '❌' } as const;

function message(issue: Issue): string {
  const template = messages[issue.code] ?? issue.code;
  const text = template.replace(/\{(\w+)\}/g, (_, k: string) => String(issue.params?.[k] ?? `{${k}}`));
  return issue.partIndex === undefined ? text : `${text} (del ${issue.partIndex + 1})`;
}

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error('Uporaba: npx tsx scripts/try-file.ts <datoteka> [--country SI]');
  process.exit(1);
}
const countryIndex = rest.indexOf('--country');
const country = (countryIndex >= 0 ? rest[countryIndex + 1] : undefined) ?? 'SI';

const result = await parsePlotFile(basename(file), new Uint8Array(readFileSync(file)));
console.log(`Koordinatni sistem: ${result.detectedCrs}, parcel: ${result.features.length}`);
for (const issue of [...(result.crsIssue ? [result.crsIssue] : []), ...result.issues]) console.log(`  ${message(issue)}`);

const exportable: ExportPlot[] = [];
const accepted: { id: string; geometry: NonNullable<ReturnType<typeof validatePlot>['geometry']> }[] = [];
result.features.forEach((f, i) => {
  const label = String(f.properties.name ?? f.properties.ime ?? f.properties.oznaka ?? `Parcela ${i + 1}`);
  const declared = typeof f.properties.areaHa === 'number' ? f.properties.areaHa : undefined;
  const r = validatePlot({ geometry: f.geometry, country, declaredAreaHa: declared, decimals: f.decimals, others: accepted });
  const area = r.areaHa === null ? '' : ` (${r.areaHa} ha)`;
  console.log(`${ICON[r.status]} ${label}${area}`);
  for (const issue of r.issues.filter((x) => x.severity !== 'info')) console.log(`     ${message(issue)}`);
  if (r.geometry) {
    accepted.push({ id: label, geometry: r.geometry });
    if (r.status !== 'error') exportable.push({ label, geometry: r.geometry, producerCountry: country, areaHa: r.areaHa });
  }
});

const out = serializeEudrGeoJson(buildEudrGeoJson(exportable));
for (const issue of out.issues) console.log(`❌ ${message(issue)}`);
writeFileSync('out.geojson', out.text);
console.log(`\nZapisano out.geojson: ${exportable.length} parcel brez napak, ${out.bytes} bajtov.`);
