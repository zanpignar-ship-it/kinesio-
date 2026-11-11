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

export const plotFormSchema = z.object({
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
