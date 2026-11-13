import { z } from 'zod';
import { Constants } from '@/lib/db/database.types';

/** Error messages are translation keys (messages/*.json), resolved in the UI. */
const email = z.string().trim().toLowerCase().email('auth.errors.email');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'auth.errors.passwordRequired'),
});

export const signUpSchema = z.object({
  email,
  password: z.string().min(8, 'auth.errors.passwordTooShort').max(72, 'auth.errors.passwordTooLong'),
});

export const resetRequestSchema = z.object({ email });
export const newPasswordSchema = z.object({
  password: z.string().min(8, 'auth.errors.passwordTooShort').max(72, 'auth.errors.passwordTooLong'),
});

/** Countries offered when creating an organization (ISO 3166-1 alpha-2). */
export const ORG_COUNTRIES = ['SI', 'HR', 'BA', 'RS', 'ME', 'MK', 'AT', 'IT', 'HU', 'DE'] as const;

/** HTML checkbox: "on" when ticked, missing when not. */
const checkbox = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());

const optionalText = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v ? v : null));

export const organizationSchema = z.object({
  name: z.string().trim().min(1, 'org.errors.name').max(200, 'org.errors.name'),
  country: z.enum(ORG_COUNTRIES, { message: 'org.errors.country' }),
  kind: z.enum(Constants.public.Enums.org_kind, { message: 'org.errors.kind' }),
  size: z.enum(Constants.public.Enums.org_size, { message: 'org.errors.size' }),
  taxId: optionalText,
  registrationNo: optionalText,
  eori: optionalText,
  wasUnderEutr: checkbox,
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
