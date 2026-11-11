import type { DrawMode } from '@/lib/map/draw-state';

/**
 * The declared-area field is needed for point plots. Multi-part plots cannot be redrawn, so their stored type
 * decides (otherwise editing a MultiPoint plot would drop its area).
 */
export function showsAreaField(mode: DrawMode, multiPartType: string | null): boolean {
  if (multiPartType) return multiPartType === 'MultiPoint' || multiPartType === 'Point';
  return mode === 'point';
}
