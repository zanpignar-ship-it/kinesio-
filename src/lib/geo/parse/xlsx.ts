import JSZip from 'jszip';
import Papa from 'papaparse';

const decode = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

/** Text of all <t> elements inside a fragment (rich text runs are joined). */
const texts = (xml: string): string => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1] ?? '')).join('');

/** "BC12" → 54 (zero based column index). */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Path of the first worksheet, following workbook.xml and its relationships. */
async function firstSheetPath(zip: JSZip): Promise<string | null> {
  const workbook = await zip.file('xl/workbook.xml')?.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  const rid = workbook && /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const target = rid && rels ? new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)?.[1] : undefined;
  if (target) return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  return zip.file('xl/worksheets/sheet1.xml') ? 'xl/worksheets/sheet1.xml' : null;
}

/** Rows (arrays of cell text) of the first sheet of an .xlsx file. Numbers keep the digits Excel stored. */
export async function readXlsxRows(data: Uint8Array): Promise<string[][]> {
  const zip = await JSZip.loadAsync(data);
  const shared = await zip.file('xl/sharedStrings.xml')?.async('string');
  const strings = shared ? [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1] ?? '')) : [];
  const path = await firstSheetPath(zip);
  const sheet = path ? await zip.file(path)?.async('string') : undefined;
  if (!sheet) throw new Error('No worksheet');
  const rows: string[][] = [];
  for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of (row[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1] ?? '';
      const body = c[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's') value = strings[Number(v)] ?? '';
      else if (type === 'inlineStr') value = texts(body);
      else if (v !== undefined) value = decode(v);
      const index = ref ? columnIndex(ref) : cells.length;
      while (cells.length < index) cells.push('');
      cells[index] = value;
    }
    if (cells.some((x) => x.trim() !== '')) rows.push(cells);
  }
  return rows;
}

/** The first sheet as semicolon CSV, so the CSV importer (column names, decimals, CRS guessing) handles it. */
export async function xlsxToCsv(data: Uint8Array): Promise<string> {
  return Papa.unparse(await readXlsxRows(data), { delimiter: ';' });
}
