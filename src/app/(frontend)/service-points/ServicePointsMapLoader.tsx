'use client'

import dynamic from 'next/dynamic'

import type { ServicePointMarkerData } from '@/lib/service-points'

import styles from './service-points.module.css'

const ServicePointsMap = dynamic(() => import('./ServicePointsMap'), {
  // MapLibre touches browser globals while rendering, so keep this import out
  // of the server render and the production build's server bundle.
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading} role="status">
      Loading map…
    </div>
  ),
})

export default function ServicePointsMapLoader({ points }: { points: ServicePointMarkerData[] }) {
  return <ServicePointsMap points={points} />
}
