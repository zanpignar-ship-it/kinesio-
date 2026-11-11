// MapLibre v6 loads its web worker (an ES module) next to its own bundle. After bundling that URL is wrong,
// so we serve the worker files from /maplibre/ and point MapLibre at them (src/components/map/plot-map.tsx).
import { copyFileSync, mkdirSync } from 'node:fs';

const from = 'node_modules/maplibre-gl/dist';
const to = 'public/maplibre';
mkdirSync(to, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) copyFileSync(`${from}/${f}`, `${to}/${f}`);
console.log('maplibre worker copied to', to);
