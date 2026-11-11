// Minimal types for shpjs v6 (the @types/shpjs package describes v3).
declare module 'shpjs' {
  import type * as GeoJSON from 'geojson';
  type Input = ArrayBuffer | Uint8Array | DataView;
  export function parseShp(shp: Input, prj?: string): GeoJSON.Geometry[];
  export function parseDbf(dbf: Input, cpg?: string): GeoJSON.GeoJsonProperties[];
}
