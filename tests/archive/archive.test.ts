import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildArchive } from '@/lib/archive/build';
import { toCsv } from '@/lib/archive/csv';

describe('toCsv', () => {
  it('writes a header, quotes when needed and starts with a BOM for Excel', () => {
    const csv = toCsv([{ a: 'x', b: 'ima "narekovaje", vejico' }, { a: null, b: 3 }], ['a', 'b']);
    expect(csv).toBe('﻿a;b\r\nx;"ima ""narekovaje"", vejico"\r\n;3\r\n');
  });
  it('serialises objects as JSON', () => {
    expect(toCsv([{ a: { k: 1 } }], ['a'])).toContain('"{""k"":1}"');
  });
});

describe('buildArchive', () => {
  it('contains GeoJSON, CSV tables, document files and a readme', async () => {
    const zip = await buildArchive({
      organizationName: 'Žaga',
      generatedAt: '2026-11-12T00:00:00Z',
      plots: [{ id: 'p1', label: 'P1', country: 'SI', validation_status: 'valid', area_ha: 1, geom: { type: 'Point', coordinates: [14.5, 46] } }],
      tables: { documents: [{ id: 'd1', title: 'Dovoljenje' }], shipments: [], audit_log: [] },
      files: [{ path: 'documents/d1/a.pdf', data: new Uint8Array([37, 80, 68, 70]) }],
    });
    const z = await JSZip.loadAsync(zip);
    expect(Object.keys(z.files).sort()).toEqual(['README.txt', 'audit_log.csv', 'documents.csv', 'files/', 'files/documents/', 'files/documents/d1/', 'files/documents/d1/a.pdf', 'plots.csv', 'plots.geojson', 'shipments.csv'].sort());
    const fc = JSON.parse(await z.file('plots.geojson')!.async('string')) as { features: { properties: { label: string } }[] };
    expect(fc.features[0]!.properties.label).toBe('P1');
    expect(await z.file('documents.csv')!.async('string')).toContain('Dovoljenje');
  });
});
