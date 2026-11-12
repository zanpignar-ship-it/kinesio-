// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderPackagePdf, type PdfLabels } from '@/components/share/package-pdf';
import type { BuyerPackage } from '@/lib/share/package';

const labels = new Proxy({}, { get: (_t, k) => String(k) }) as PdfLabels;

const pkg = (dds: string | null): BuyerPackage =>
  ({
    expires_at: '2027-01-01T00:00:00Z',
    include_documents: false,
    organization: { name: 'Žaga Čšž', country: 'SI', tax_id: null, registration_no: null, eori: null, address: null },
    shipments: [
      {
        id: 's1', internal_ref: 'S-1', shipment_date: null, status: dds ? 'submitted' : 'draft', activity: 'export', country_of_production: 'SI',
        dds_reference_no: dds, dds_verification_no: dds ? 'VX12AB' : null, customer: null,
        items: [], documents: [],
        plots: [{ label: 'P', country: 'SI', area_ha: 1, geometry: { type: 'Point', coordinates: [14.5, 46] } }],
      },
    ],
  }) as unknown as BuyerPackage;

describe('buyer PDF', () => {
  it('renders with and without a DDS QR code', async () => {
    const without = await renderPackagePdf(pkg(null), labels);
    const withQr = await renderPackagePdf(pkg('26SI000123'), labels);
    expect(without.subarray(0, 5).toString()).toBe('%PDF-');
    expect(withQr.length).toBeGreaterThan(without.length);
  }, 30_000);
});
