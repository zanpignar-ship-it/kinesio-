/**
 * All legal / EUDR-system constants in one place.
 * Values marked `TODO: preveri` could not be confirmed in an official EU source yet.
 */
import type { PlotGeometry } from '@/lib/geo/types';

/** Minimum decimal digits for latitude/longitude. TODO: preveri čl. 2(28) Uredbe (EU) 2023/1115 na EUR-Lex. */
export const MIN_COORD_DECIMALS = 6;

/** Plots above this area must be described by a polygon. TODO: preveri čl. 2(28) Uredbe (EU) 2023/1115. */
export const POINT_MAX_AREA_HA = 4;

/** Area TRACES assumes for a point without `Area`. TODO: preveri EUDR GeoJSON File Description v1.5. */
export const TRACES_DEFAULT_POINT_AREA_HA = 4;

/** Max geolocation size per DDS. TODO: preveri "API and UI Validation Rules" (EUDR Information System). */
export const EXPORT_MAX_BYTES = 25 * 1024 * 1024;

/** Allowed geometry types. Source: EUDR GeoJSON File Description v1.5 (izvleček; TODO: preveri celoten dokument). */
export const ALLOWED_GEOMETRY_TYPES: readonly PlotGeometry['type'][] = ['Point', 'MultiPoint', 'Polygon', 'MultiPolygon'];

/** Property names read by the EUDR Information System. TODO: preveri EUDR GeoJSON File Description v1.5. */
export const EUDR_PROPERTY_NAMES = {
  producerName: 'ProducerName',
  producerCountry: 'ProducerCountry',
  productionPlace: 'ProductionPlace',
  area: 'Area',
} as const;

/** Product decisions (not legal rules). */
export const DUPLICATE_IOU = 0.95;
export const DUPLICATE_POINT_METERS = 5;
export const COUNTRY_TOLERANCE_METERS = 200;
