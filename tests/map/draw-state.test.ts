import { describe, expect, it } from 'vitest';
import { drawReducer, fromGeometry, initialDraw, toGeometry } from '@/lib/map/draw-state';

const A = [14.861234, 45.641234];
const B = [14.862514, 45.641234];
const C = [14.862514, 45.642134];
const D = [14.861234, 45.642134];

describe('drawReducer', () => {
  it('in point mode a tap replaces the point', () => {
    let s = drawReducer(initialDraw('point'), { type: 'add', position: A });
    s = drawReducer(s, { type: 'add', position: B });
    expect(s.vertices).toEqual([B]);
  });
  it('in polygon mode taps add vertices; undo removes the last one; clear empties', () => {
    let s = initialDraw('polygon');
    for (const p of [A, B, C]) s = drawReducer(s, { type: 'add', position: p });
    expect(s.vertices).toHaveLength(3);
    s = drawReducer(s, { type: 'undo' });
    expect(s.vertices).toEqual([A, B]);
    s = drawReducer(s, { type: 'clear' });
    expect(s.vertices).toEqual([]);
  });
  it('moves a vertex (drag on the phone)', () => {
    let s = initialDraw('polygon');
    for (const p of [A, B, C]) s = drawReducer(s, { type: 'add', position: p });
    s = drawReducer(s, { type: 'move', index: 1, position: D });
    expect(s.vertices[1]).toEqual(D);
  });
  it('switching mode clears the drawing', () => {
    let s = drawReducer(initialDraw('point'), { type: 'add', position: A });
    s = drawReducer(s, { type: 'mode', mode: 'polygon' });
    expect(s).toEqual(initialDraw('polygon'));
  });
  it('rounds positions to 7 decimals', () => {
    const s = drawReducer(initialDraw('point'), { type: 'add', position: [14.123456789, 46.987654321] });
    expect(s.vertices[0]).toEqual([14.1234568, 46.9876543]);
  });
});

describe('toGeometry', () => {
  it('returns a point', () => {
    expect(toGeometry({ mode: 'point', vertices: [A] })).toEqual({ geometry: { type: 'Point', coordinates: A }, problem: null });
  });
  it('closes a polygon ring', () => {
    const r = toGeometry({ mode: 'polygon', vertices: [A, B, C] });
    expect(r.geometry).toEqual({ type: 'Polygon', coordinates: [[A, B, C, A]] });
  });
  it('reports a polygon with fewer than 3 points instead of saving it', () => {
    expect(toGeometry({ mode: 'polygon', vertices: [A, B] })).toEqual({ geometry: null, problem: 'tooFewPoints' });
    expect(toGeometry({ mode: 'point', vertices: [] })).toEqual({ geometry: null, problem: 'empty' });
  });
});

describe('fromGeometry', () => {
  it('opens a polygon for editing without the closing vertex', () => {
    expect(fromGeometry({ type: 'Polygon', coordinates: [[A, B, C, A]] })).toEqual({ mode: 'polygon', vertices: [A, B, C] });
  });
  it('opens a point', () => expect(fromGeometry({ type: 'Point', coordinates: A })).toEqual({ mode: 'point', vertices: [A] }));
  it('cannot edit multi-part geometries in the drawing tool', () => {
    expect(fromGeometry({ type: 'MultiPolygon', coordinates: [[[A, B, C, A]], [[A, B, D, A]]] })).toBeNull();
  });
});
