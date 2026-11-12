import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parsePlotFile } from '@/lib/geo/parse';
import { readXlsxRows } from '@/lib/geo/parse/xlsx';

/** Minimal .xlsx as Excel writes it: shared strings for text, plain numbers for coordinates. */
async function makeXlsx(rows: (string | number)[][]): Promise<Uint8Array> {
  const zip = new JSZip();
  const strings: string[] = [];
  const cellXml = rows
    .map((r, y) => {
      const cells = r
        .map((v, x) => {
          const ref = `${String.fromCharCode(65 + x)}${y + 1}`;
          if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
          strings.push(v);
          return `<c r="${ref}" t="s"><v>${strings.length - 1}</v></c>`;
        })
        .join('');
      return `<row r="${y + 1}">${cells}</row>`;
    })
    .join('');
  zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="Parcele" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/sharedStrings.xml', `<sst>${strings.map((s) => `<si><t>${s.replace(/&/g, '&amp;')}</t></si>`).join('')}</sst>`);
  zip.file('xl/worksheets/sheet1.xml', `<worksheet><sheetData>${cellXml}</sheetData></worksheet>`);
  return zip.generateAsync({ type: 'uint8array' });
}

describe('xlsx import', () => {
  it('reads the first sheet, including Slovenian characters and gaps', async () => {
    const rows = await readXlsxRows(await makeXlsx([['Ime', 'Širina', 'Dolžina'], ['Gozd Č & Ž', 46.051234, 14.512345]]));
    expect(rows).toEqual([['Ime', 'Širina', 'Dolžina'], ['Gozd Č & Ž', '46.051234', '14.512345']]);
  });

  it('turns rows into plots like a CSV file', async () => {
    const data = await makeXlsx([['ime', 'sirina', 'dolzina', 'povrsina'], ['Parcela 1', 46.051234, 14.512345, 2.5], ['Parcela 2', 46.061234, 14.522345, 1]]);
    const res = await parsePlotFile('parcele.xlsx', data);
    expect(res.features).toHaveLength(2);
    expect(res.features[0]!.properties).toMatchObject({ name: 'Parcela 1', areaHa: 2.5 });
    expect(res.features[0]!.geometry).toMatchObject({ type: 'Point', coordinates: [14.512345, 46.051234] });
  });

  it('a broken file is reported, not thrown', async () => {
    const res = await parsePlotFile('slaba.xlsx', new Uint8Array([1, 2, 3]));
    expect(res.features).toHaveLength(0);
  });
});
