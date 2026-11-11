import { z } from 'zod';
import { Constants } from '@/lib/db/database.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = z.preprocess((v) => (typeof v === 'string' && UUID.test(v) ? v : null), z.string().nullable());
const idList = z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter((s) => UUID.test(s)) : []), z.array(z.string()).max(2000));
const jsonList = (v: unknown) => {
  if (typeof v !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const quantity = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : typeof v === 'string' ? Number(v.replace(/\s/g, '').replace(',', '.')) : v),
  z.number({ message: 'ship.errors.quantity' }).finite('ship.errors.quantity').positive('ship.errors.quantity').max(1e9, 'ship.errors.quantity').nullable(),
);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const itemSchema = z.object({
  productId: z.string().regex(UUID, 'ship.errors.product'),
  netMassKg: quantity,
  volumeM3: quantity,
  pieces: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : Number(v)), z.number().int('ship.errors.quantity').positive('ship.errors.quantity').nullable()),
});

export const referenceSchema = z.object({
  kind: z.enum(Constants.public.Enums.upstream_ref_kind),
  referenceNo: z.string().trim().min(1, 'ship.errors.referenceNo').max(80, 'ship.errors.referenceNo'),
  verificationNo: optionalText(80),
  supplierId: uuidOrNull,
});

export const shipmentFormSchema = z.object({
  internalRef: z.string().trim().min(1, 'ship.errors.internalRef').max(80, 'ship.errors.internalRef'),
  customerId: uuidOrNull,
  shipmentDate: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  mode: z.enum(Constants.public.Enums.shipment_mode),
  activity: z.enum(Constants.public.Enums.shipment_activity),
  countryOfProduction: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.string().regex(/^[A-Z]{2}$/).nullable()),
  items: z.preprocess(jsonList, z.array(itemSchema).max(50)),
  plotIds: idList,
  documentIds: idList,
  references: z.preprocess(jsonList, z.array(referenceSchema).max(200)),
});
export type ShipmentFormInput = z.infer<typeof shipmentFormSchema>;

export const submitSchema = z.object({
  ddsReference: z.string({ message: 'ship.errors.ddsReference' }).trim().min(1, 'ship.errors.ddsReference').max(80),
  ddsVerification: optionalText(80),
});
