import { describe, expect, it } from 'vitest';
import { mapImportRows, recordKey } from '@/lib/masterdata/import';

describe('master data import', () => {
  it('maps Slovenian headers, guesses the supplier kind and defaults the country', () => {
    const r = mapImportRows('suppliers', [
      ['Ime in priimek', 'Naslov', 'Davčna številka', 'Država'],
      ['Janez Novak', 'Gozdna pot 1, Kočevje', '12345678', ''],
      ['Gozdarstvo Grča d.o.o.', 'Ljubljana', 'SI87654321', 'si'],
      ['', '', '', ''],
    ], 'SI');
    expect(r.errors).toEqual([]);
    expect(r.records).toEqual([
      { name: 'Janez Novak', country: 'SI', kind: 'forest_owner', taxId: '12345678', address: 'Gozdna pot 1, Kočevje' },
      { name: 'Gozdarstvo Grča d.o.o.', country: 'SI', kind: 'company', taxId: 'SI87654321', address: 'Ljubljana' },
    ]);
  });

  it('reports bad rows with the spreadsheet row number', () => {
    const r = mapImportRows('customers', [['Naziv', 'E-pošta', 'Zemlja'], ['Kupac d.o.o.', 'ni-email', 'HR'], ['Holz GmbH', 'info@holz.at', 'AT']], 'SI');
    expect(r.errors).toEqual([{ row: 2, message: 'md.errors.email' }]);
    expect(r.records).toEqual([{ name: 'Holz GmbH', country: 'AT', email: 'info@holz.at' }]);
  });

  it('needs a name column', () => {
    expect(mapImportRows('customers', [['Foo', 'Bar']], 'SI').errors[0]!.message).toBe('md.import.noName');
    expect(recordKey({ name: ' Janez ', country: 'si' })).toBe('janez|SI');
  });
});
