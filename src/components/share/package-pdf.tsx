import path from 'node:path';
import { Document, Font, Page, Path, Circle, StyleSheet, Svg, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { BuyerPackage } from '@/lib/share/package';
import { ddsQrText, qrPath } from '@/lib/share/qr';
import { plotsToSvg } from '@/lib/share/svg-map';

// DejaVu Sans covers č, ć, đ, š, ž (the built-in PDF fonts do not).
const fontDir = path.join(process.cwd(), 'fonts');
Font.register({
  family: 'DejaVu',
  fonts: [
    { src: path.join(fontDir, 'DejaVuSans.ttf') },
    { src: path.join(fontDir, 'DejaVuSans-Bold.ttf'), fontWeight: 'bold' },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const s = StyleSheet.create({
  page: { fontFamily: 'DejaVu', fontSize: 9, padding: 32, color: '#1c1917' },
  h1: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  h2: { fontSize: 11, fontWeight: 'bold', marginTop: 14, marginBottom: 6 },
  muted: { color: '#78716c' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#d6d3d1', paddingVertical: 3 },
  cell: { flex: 1, paddingRight: 4 },
  head: { fontWeight: 'bold' },
  box: { borderWidth: 0.5, borderColor: '#d6d3d1', marginTop: 4 },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7, color: '#78716c' },
});

export type PdfLabels = Record<
  | 'title' | 'supplier' | 'shipment' | 'ddsReference' | 'verification' | 'notSubmitted' | 'products' | 'plots' | 'documents' | 'map' | 'area'
  | 'validTo' | 'noDocuments' | 'date' | 'customer' | 'taxId' | 'eori' | 'country' | 'quantity' | 'hsCode' | 'scientificName' | 'generatedBy' | 'disclaimer',
  string
>;

const qty = (i: BuyerPackage['shipments'][number]['items'][number]) =>
  [i.net_mass_kg ? `${i.net_mass_kg} kg` : null, i.volume_m3 ? `${i.volume_m3} m³` : null, i.pieces ? `${i.pieces} pcs` : null].filter(Boolean).join(', ');

function PackageDocument({ pkg, labels }: { pkg: BuyerPackage; labels: PdfLabels }) {
  const o = pkg.organization;
  return (
    <Document title={`${labels.title} – ${o.name}`} author="IZVOR">
      {pkg.shipments.map((sh) => {
        const svg = plotsToSvg(sh.plots.map((p) => p.geometry), 520, 220);
        return (
          <Page key={sh.id} size="A4" style={s.page}>
            <Text style={s.h1}>{labels.title}</Text>
            <Text style={s.muted}>
              {labels.shipment}: {sh.internal_ref}
              {sh.shipment_date ? ` · ${labels.date}: ${sh.shipment_date}` : ''}
              {sh.customer ? ` · ${labels.customer}: ${sh.customer}` : ''}
            </Text>

            <Text style={s.h2}>{labels.supplier}</Text>
            <Text>{o.name}</Text>
            {o.address ? <Text>{o.address}</Text> : null}
            <Text>
              {labels.country}: {o.country}
              {o.tax_id ? ` · ${labels.taxId}: ${o.tax_id}` : ''}
              {o.eori ? ` · ${labels.eori}: ${o.eori}` : ''}
            </Text>

            <Text style={s.h2}>{labels.ddsReference}</Text>
            {sh.dds_reference_no ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ flex: 1 }}>
                  {sh.dds_reference_no}
                  {sh.dds_verification_no ? ` · ${labels.verification}: ${sh.dds_verification_no}` : ''}
                </Text>
                <DdsQr text={ddsQrText(sh.dds_reference_no, sh.dds_verification_no)} />
              </View>
            ) : (
              <Text style={s.muted}>{labels.notSubmitted}</Text>
            )}

            <Text style={s.h2}>{labels.products}</Text>
            <View style={[s.row, s.head]}>
              <Text style={[s.cell, { flex: 2 }]}>{labels.products}</Text>
              <Text style={s.cell}>{labels.hsCode}</Text>
              <Text style={[s.cell, { flex: 1.5 }]}>{labels.scientificName}</Text>
              <Text style={s.cell}>{labels.quantity}</Text>
            </View>
            {sh.items.map((i, n) => (
              <View key={n} style={s.row}>
                <Text style={[s.cell, { flex: 2 }]}>{i.product}</Text>
                <Text style={s.cell}>{i.hs_code}</Text>
                <Text style={[s.cell, { flex: 1.5 }]}>{i.scientific_name ?? '–'}</Text>
                <Text style={s.cell}>{qty(i)}</Text>
              </View>
            ))}

            {sh.plots.length ? (
              <>
                <Text style={s.h2}>{labels.map}</Text>
                <View style={s.box}>
                  <Svg width={520} height={220}>
                    {svg.paths.map((d, n) => (
                      <Path key={n} d={d} fill="#bbf7d0" stroke="#15803d" strokeWidth={1} />
                    ))}
                    {svg.points.map(([x, y], n) => (
                      <Circle key={n} cx={x} cy={y} r={3} fill="#15803d" />
                    ))}
                  </Svg>
                </View>
                <Text style={s.h2}>{labels.plots}</Text>
                <View style={[s.row, s.head]}>
                  <Text style={[s.cell, { flex: 2 }]}>{labels.plots}</Text>
                  <Text style={s.cell}>{labels.country}</Text>
                  <Text style={s.cell}>{labels.area}</Text>
                </View>
                {sh.plots.map((p, n) => (
                  <View key={n} style={s.row}>
                    <Text style={[s.cell, { flex: 2 }]}>{p.label}</Text>
                    <Text style={s.cell}>{p.country}</Text>
                    <Text style={s.cell}>{p.area_ha ?? '–'}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {pkg.include_documents ? (
              <>
                <Text style={s.h2}>{labels.documents}</Text>
                {sh.documents.length === 0 ? <Text style={s.muted}>{labels.noDocuments}</Text> : null}
                {sh.documents.map((d, n) => (
                  <Text key={n}>
                    • {d.title}
                    {d.valid_to ? ` (${labels.validTo} ${d.valid_to})` : ''}
                  </Text>
                ))}
              </>
            ) : null}

            <Text style={s.footer} fixed>
              {labels.generatedBy} · {labels.disclaimer}
            </Text>
          </Page>
        );
      })}
    </Document>
  );
}

/** QR code with the DDS numbers for the forwarder (vector, 72 pt with a quiet zone). */
function DdsQr({ text }: { text: string }) {
  const { size, d } = qrPath(text);
  const quiet = 2;
  return (
    <Svg width={72} height={72} viewBox={`${-quiet} ${-quiet} ${size + 2 * quiet} ${size + 2 * quiet}`}>
      <Path d={d} fill="#000" />
    </Svg>
  );
}

export function renderPackagePdf(pkg: BuyerPackage, labels: PdfLabels): Promise<Buffer> {
  return renderToBuffer(<PackageDocument pkg={pkg} labels={labels} />);
}
