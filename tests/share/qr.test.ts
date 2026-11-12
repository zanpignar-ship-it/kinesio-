import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { ddsQrText, qrPath } from '@/lib/share/qr';

describe('qr', () => {
  it('draws every dark module of the QR code', () => {
    const { size, d } = qrPath('DDS 26SI000123 / VX12AB');
    const qr = QRCode.create('DDS 26SI000123 / VX12AB', { errorCorrectionLevel: 'M' });
    expect(size).toBe(qr.modules.size);
    const dark = Array.from(qr.modules.data).filter(Boolean).length;
    expect(d.match(/M/g)).toHaveLength(dark);
  });
  it('formats the DDS numbers', () => {
    expect(ddsQrText('26SI1', 'V1')).toBe('DDS 26SI1 / V1');
    expect(ddsQrText('26SI1', null)).toBe('DDS 26SI1');
  });
});
