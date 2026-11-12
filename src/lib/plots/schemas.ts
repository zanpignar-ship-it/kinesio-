import { z } from 'zod';
import { ORG_COUNTRIES } from '@/lib/auth/schemas';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** "2,5" or "2.5" → 2.5; empty → undefined. */
const optionalHectares = z.preprocess(
  (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : Number(v.trim().replace(',', '.'))) : v),
  z.number({ message: 'plots.errors.area' }).min(0, 'plots.errors.area').max(100_000, 'plots.errors.area').optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().uuid('plots.errors.supplier').optional(),
);

export const plotFormSchema = z.object({
  supplierId: optionalUuid,
  label: z.string().trim().min(1, 'plots.errors.label').max(120, 'plots.errors.label'),
  country: z.enum(ORG_COUNTRIES, { message: 'plots.errors.country' }),
  declaredAreaHa: optionalHectares,
  cadastralNo: optionalText(60),
  cadastralMunicipality: optionalText(120),
  postalAddress: optionalText(300),
});
export type PlotFormInput = z.infer<typeof plotFormSchema>;

const position = z.array(z.number().finite()).min(2).max(3);
const ring = z.array(position);

export const geometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: position }),
  z.object({ type: z.literal('MultiPoint'), coordinates: z.array(position).min(1) }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(ring).min(1) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(ring).min(1)).min(1) }),
]);

const MAX_IMPORT_ROWS = 2000;
const uuidPart = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** One imported row; a broken value is dropped (the row is then validated like any other) instead of failing the import. */
const importRowSchema = z.object({
  label: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string().trim().max(120).catch('')),
  geometry: geometrySchema.nullable().catch(null),
  declaredAreaHa: z.number().finite().min(0).max(100_000).optional().catch(undefined),
  decimals: z.object({ min: z.number().int().min(0).max(20), max: z.number().int().min(0).max(20) }).nullable().catch(null),
});

export const importPayloadSchema = z.object({
  locale: z.string().max(10),
  country: z.enum(ORG_COUNTRIES),
  fileName: z.string().max(255),
  // "<organization id>/<random id>/<safe file name>" – the organization part is checked in the action.
  filePath: z
    .string()
    .regex(new RegExp(`^${uuidPart}/${uuidPart}/[\\w.\\-]{1,200}$`, 'i'))
    .nullable(),
  detectedCrs: z.string().max(40),
  supplierId: optionalUuid,
  rows: z.array(importRowSchema).min(1).max(MAX_IMPORT_ROWS),
});
export type ImportPayloadInput = z.input<typeof importPayloadSchema>;
