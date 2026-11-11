import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { PdfLabels } from '@/components/share/package-pdf';

export async function pdfLabels(locale: string): Promise<PdfLabels> {
  const t = await getTranslations({ locale, namespace: 'share' });
  const tc = await getTranslations({ locale, namespace: 'common' });
  const td = await getTranslations({ locale, namespace: 'ship.dds' });
  const keys = ['title', 'supplier', 'shipment', 'ddsReference', 'verification', 'notSubmitted', 'products', 'plots', 'documents', 'map', 'area', 'validTo', 'noDocuments', 'date', 'customer', 'taxId', 'eori', 'country', 'quantity', 'generatedBy'] as const;
  return {
    ...(Object.fromEntries(keys.map((k) => [k, t(k)])) as Omit<PdfLabels, 'hsCode' | 'scientificName' | 'disclaimer'>),
    hsCode: td('hsCode'),
    scientificName: td('scientificName'),
    disclaimer: tc('disclaimer'),
  };
}
