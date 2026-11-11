import type * as GeoJSON from 'geojson';
import type { PlotGeometry } from '@/lib/geo/types';

export type DrawMode = 'point' | 'polygon';
export type DrawState = { mode: DrawMode; vertices: GeoJSON.Position[] };
export type DrawAction =
  | { type: 'add'; position: GeoJSON.Position }
  | { type: 'move'; index: number; position: GeoJSON.Position }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'mode'; mode: DrawMode }
  | { type: 'load'; state: DrawState };

export const initialDraw = (mode: DrawMode): DrawState => ({ mode, vertices: [] });

const round = (p: GeoJSON.Position): GeoJSON.Position => [Math.round((p[0] ?? 0) * 1e7) / 1e7, Math.round((p[1] ?? 0) * 1e7) / 1e7];

export function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case 'add':
      return { ...state, vertices: state.mode === 'point' ? [round(action.position)] : [...state.vertices, round(action.position)] };
    case 'move':
      return { ...state, vertices: state.vertices.map((v, i) => (i === action.index ? round(action.position) : v)) };
    case 'undo':
      return { ...state, vertices: state.vertices.slice(0, -1) };
    case 'clear':
      return { ...state, vertices: [] };
    case 'mode':
      return initialDraw(action.mode);
    case 'load':
      return action.state;
  }
}

export type DrawProblem = 'empty' | 'tooFewPoints';

/** The geometry being drawn, or why it cannot be saved yet. */
export function toGeometry(state: DrawState): { geometry: PlotGeometry | null; problem: DrawProblem | null } {
  const [first] = state.vertices;
  if (!first) return { geometry: null, problem: 'empty' };
  if (state.mode === 'point') return { geometry: { type: 'Point', coordinates: first }, problem: null };
  if (state.vertices.length < 3) return { geometry: null, problem: 'tooFewPoints' };
  return { geometry: { type: 'Polygon', coordinates: [[...state.vertices, first]] }, problem: null };
}

/** Load a stored geometry into the drawing tool; multi-part geometries cannot be edited here. */
export function fromGeometry(geometry: GeoJSON.Geometry | null): DrawState | null {
  if (!geometry) return null;
  if (geometry.type === 'Point') return { mode: 'point', vertices: [geometry.coordinates] };
  if (geometry.type === 'Polygon' && geometry.coordinates.length === 1) {
    const ring = geometry.coordinates[0] ?? [];
    return { mode: 'polygon', vertices: ring.slice(0, -1) };
  }
  return null;
}
