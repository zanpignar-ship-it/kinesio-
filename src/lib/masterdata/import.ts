import { customerSchema, supplierSchema } from './schemas';

export type ImportEntity = 'customers' | 'suppliers';
export type ImportRow = Record<string, string>;
export type ImportResult = { records: ImportRow[]; errors: { row: number; message: string }[] };

const normalize = (h: string): string =>
  h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

/** Column names people use in Slovenian/Croatian/Serbian/Bosnian/English sheets → our fields. */
const HEADERS: Record<string, string[]> = {
  name: ['name', 'ime', 'naziv', 'ime_in_priimek', 'naziv_podjetja', 'firma', 'podjetje', 'dobavitelj', 'kupec', 'lastnik', 'vlasnik', 'company'],
  country: ['country', 'drzava', 'zemlja', 'country_code'],
  address: ['address', 'naslov', 'adresa', 'sedez'],
  email: ['email', 'e_mail', 'e_posta', 'eposta', 'mail'],
  taxId: ['tax_id', 'vat', 'davcna', 'davcna_stevilka', 'id_za_ddv', 'oib', 'pib', 'jib', 'id_broj'],
  eori: ['eori', 'eori_stevilka', 'eori_broj'],
  kind: ['kind', 'vrsta', 'tip', 'type'],
  simplifiedDeclarationId: ['simplified_declaration_id', 'poenostavljena_izjava', 'sd', 'identifikator_poenostavljene_izjave'],
};

const COMPANY = /\b(d\.?\s?o\.?\s?o|d\.?\s?d|s\.?\s?p|k\.?\s?d|ltd|gmbh|llc|doo|ad|srl|spa|company|podjetje|preduzece|poduzece|zadruga)\b/i;

function kindOf(raw: string | undefined, name: string): 'forest_owner' | 'company' {
  const v = normalize(raw ?? '');
  if (/podjet|company|firma|predu|podu|druzb/.test(v)) return 'company';
  if (/lastnik|vlasnik|owner|fiz/.test(v)) return 'forest_owner';
  return COMPANY.test(name) ? 'company' : 'forest_owner';
}

/** First row = header. Rows that fail validation are reported with their spreadsheet row number. */
export function mapImportRows(entity: ImportEntity, rows: string[][], defaultCountry: string): ImportResult {
  const [header, ...body] = rows;
  if (!header) return { records: [], errors: [{ row: 1, message: 'md.import.noHeader' }] };
  const index: Record<string, number> = {};
  header.forEach((h, i) => {
    const key = normalize(h);
    for (const [field, names] of Object.entries(HEADERS)) if (index[field] === undefined && names.includes(key)) index[field] = i;
  });
  if (index.name === undefined) return { records: [], errors: [{ row: 1, message: 'md.import.noName' }] };
  const get = (r: string[], f: string) => (index[f] === undefined ? '' : (r[index[f]!] ?? '').trim());
  const out: ImportResult = { records: [], errors: [] };
  body.forEach((r, i) => {
    if (r.every((c) => !c?.trim())) return;
    const name = get(r, 'name');
    const base = { name, country: (get(r, 'country') || defaultCountry).toUpperCase(), address: get(r, 'address'), email: get(r, 'email') };
    const parsed =
      entity === 'customers'
        ? customerSchema.safeParse({ ...base, eori: get(r, 'eori') })
        : supplierSchema.safeParse({ ...base, kind: kindOf(get(r, 'kind'), name), taxId: get(r, 'taxId'), simplifiedDeclarationId: get(r, 'simplifiedDeclarationId') });
    if (!parsed.success) {
      out.errors.push({ row: i + 2, message: parsed.error.issues[0]?.message ?? 'md.errors.unknown' });
      return;
    }
    const rec: ImportRow = {};
    for (const [k, v] of Object.entries(parsed.data)) if (v !== null && v !== undefined && v !== '') rec[k] = String(v);
    out.records.push(rec);
  });
  return out;
}

/** Key for skipping records that already exist (same name and country, case-insensitive). */
export const recordKey = (r: { name: string; country: string }) => `${r.name.trim().toLowerCase()}|${r.country.toUpperCase()}`;
