import { customerSchema, productSchema, supplierSchema } from './schemas';

export type Entity = 'customers' | 'products' | 'suppliers';
export const ENTITIES: readonly Entity[] = ['customers', 'products', 'suppliers'];
export const isEntity = (v: string): v is Entity => (ENTITIES as readonly string[]).includes(v);

export type FieldType = 'text' | 'email' | 'country' | 'hsCode' | 'species' | 'supplierKind';
export type Field = { name: string; column: string; type: FieldType; required?: boolean };

export const FIELDS: Record<Entity, Field[]> = {
  customers: [
    { name: 'name', column: 'name', type: 'text', required: true },
    { name: 'country', column: 'country', type: 'country', required: true },
    { name: 'address', column: 'address', type: 'text' },
    { name: 'email', column: 'email', type: 'email' },
    { name: 'eori', column: 'eori', type: 'text' },
  ],
  products: [
    { name: 'name', column: 'name', type: 'text', required: true },
    { name: 'hsCode', column: 'hs_code', type: 'hsCode', required: true },
    { name: 'speciesId', column: 'species_id', type: 'species' },
    { name: 'tradeName', column: 'trade_name', type: 'text' },
  ],
  suppliers: [
    { name: 'name', column: 'name', type: 'text', required: true },
    { name: 'country', column: 'country', type: 'country', required: true },
    { name: 'kind', column: 'kind', type: 'supplierKind', required: true },
    { name: 'taxId', column: 'tax_id', type: 'text' },
    { name: 'address', column: 'address', type: 'text' },
    { name: 'email', column: 'email', type: 'email' },
    { name: 'simplifiedDeclarationId', column: 'simplified_declaration_id', type: 'text' },
  ],
};

export const SCHEMAS = { customers: customerSchema, products: productSchema, suppliers: supplierSchema } as const;

/** Form values (camelCase) → table columns. */
export function toColumns(entity: Entity, data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(FIELDS[entity].map((f) => [f.column, data[f.name] ?? null]));
}

/** Table row → form values. */
export function toFormValues(entity: Entity, row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(FIELDS[entity].map((f) => [f.name, row[f.column] === null || row[f.column] === undefined ? '' : String(row[f.column])]));
}
