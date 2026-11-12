import QRCode from 'qrcode';

/** QR code as one SVG path (unit squares) and its size in modules – drawn directly in the PDF. */
export function qrPath(text: string): { size: number; d: string } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const parts: string[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (qr.modules.get(x, y)) parts.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return { size, d: parts.join('') };
}

/** Text the forwarder scans: the DDS reference and verification numbers. */
export function ddsQrText(reference: string, verification: string | null): string {
  return verification ? `DDS ${reference} / ${verification}` : `DDS ${reference}`;
}
