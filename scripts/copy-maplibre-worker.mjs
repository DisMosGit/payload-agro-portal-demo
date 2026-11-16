import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * MapLibre runs tile parsing in a module worker. Turbopack's generated worker
 * URL 404s in this project, so the self-contained worker is copied to
 * `public/` and registered with `maplibregl.setWorkerUrl()` instead.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'node_modules/maplibre-gl/dist')

mkdirSync(resolve(root, 'public'), { recursive: true })

copyFileSync(
  resolve(dist, 'maplibre-gl-worker.mjs'),
  resolve(root, 'public/maplibre-gl-worker.mjs'),
)
