import type * as GeoJSON from 'geojson';

/** Small, realistic sample for a first look at IZVOR (Kočevje area, Slovenia). Labels say it is a sample. */
export const SAMPLE = {
  supplier: { name: 'Primer: Janez Novak', kind: 'forest_owner' as const, country: 'SI', address: 'Gozdna pot 1, 1330 Kočevje' },
  customer: { name: 'Primer: Holz GmbH', country: 'AT' },
  product: { name: 'Primer: hlodovina smreke', hsCode: '4403', species: 'Picea abies', tradeName: 'Smrekovi hlodi' },
  plots: [
    {
      label: 'Primer: Gozd pod Mestnim vrhom',
      cadastralNo: '1234/5',
      cadastralMunicipality: 'Kočevje',
      harvestFrom: '2026-01-12',
      harvestTo: '2026-02-20',
      geometry: {
        type: 'Polygon',
        coordinates: [[[14.861234, 45.641234], [14.864512, 45.641187], [14.864733, 45.643412], [14.861521, 45.643598], [14.861234, 45.641234]]],
      } as GeoJSON.Polygon,
    },
    {
      label: 'Primer: Parcela ob Rinži',
      cadastralNo: '876/2',
      cadastralMunicipality: 'Mozelj',
      harvestFrom: '2026-02-01',
      harvestTo: '2026-02-15',
      declaredAreaHa: 1.2,
      geometry: { type: 'Point', coordinates: [14.832145, 45.627613] } as GeoJSON.Point,
    },
  ],
  shipment: { internalRef: 'PRIMER-1', activity: 'export' as const, netMassKg: 24000 },
};
