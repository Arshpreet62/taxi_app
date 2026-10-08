// MapLibre runs its tile work in a web worker that bundlers can't see. Serve it from public/.
import { copyFileSync, mkdirSync } from 'node:fs'
mkdirSync('public', { recursive: true })
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/maplibre-gl-worker.mjs')
