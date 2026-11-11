import type * as GeoJSON from 'geojson';

/** ~1 ha square near Kočevje, counter-clockwise, closed, 6 decimals. */
export const KOCEVJE_SQUARE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [14.861234, 45.641234],
      [14.862514, 45.641234],
      [14.862514, 45.642134],
      [14.861234, 45.642134],
      [14.861234, 45.641234],
    ],
  ],
};

/** Self-intersecting "bow tie". */
export const BOW_TIE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [14.8, 45.6],
      [14.81, 45.61],
      [14.81, 45.6],
      [14.8, 45.61],
      [14.8, 45.6],
    ],
  ],
};
