import { z } from 'zod';
import { Constants } from '@/lib/db/database.types';

/** Countries offered for customers and suppliers (EU + region); the database accepts any ISO 3166-1 alpha-2 code. */
export const COUNTRIES = [
  'SI', 'HR', 'BA', 'RS', 'ME', 'MK', 'AL', 'XK', 'AT', 'IT', 'HU', 'DE', 'CZ', 'SK', 'PL', 'FR', 'NL', 'BE', 'LU', 'ES', 'PT',
  'DK', 'SE', 'FI', 'EE', 'LV', 'LT', 'IE', 'GR', 'CY', 'MT', 'RO', 'BG', 'CH', 'GB', 'NO', 'TR', 'UA',
] as const;

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'md.errors.tooLong')
    .optional()
    .transform((v) => (v ? v : null));
const name = z.string().trim().min(1, 'md.errors.name').max(200, 'md.errors.name');
const country = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'md.errors.country');
const email = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.string().email('md.errors.email').nullable());

export const customerSchema = z.object({ name, country, address: opt(300), email, eori: opt(40) });

export const productSchema = z.object({
  name,
  hsCode: z.string().trim().min(2, 'md.errors.hsCode').max(10, 'md.errors.hsCode'),
  speciesId: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : Number(v)), z.number().int().positive().nullable()),
  tradeName: opt(200),
});

export const supplierSchema = z.object({
  name,
  country,
  kind: z.enum(Constants.public.Enums.supplier_kind, { message: 'md.errors.kind' }),
  taxId: opt(40),
  address: opt(300),
  email,
  simplifiedDeclarationId: opt(80),
});
