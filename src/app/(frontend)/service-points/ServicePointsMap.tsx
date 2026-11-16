'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'

import type { ServicePointMarkerData } from '@/lib/service-points'
import { phoneHref, safeWebsiteURL } from '@/lib/service-point-utils'

import styles from './service-points.module.css'

const styleURL = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim()

function appendContact(
  parent: HTMLElement,
  label: string,
  text: string,
  href: string | null,
): void {
  const line = document.createElement('p')
  const labelSpan = document.createElement('span')
  labelSpan.className = styles.contactLabel
  labelSpan.textContent = label
  line.appendChild(labelSpan)

  if (href) {
    const link = document.createElement('a')
    link.href = href
    link.textContent = text

    if (href.startsWith('http://') || href.startsWith('https://')) {
      link.target = '_blank'
      link.rel = 'noreferrer noopener'
    }

    line.appendChild(link)
  } else {
    line.appendChild(document.createTextNode(text))
  }

  parent.appendChild(line)
}

function createPopupContent(point: ServicePointMarkerData): HTMLElement {
  const content = document.createElement('div')
  content.className = styles.popupContent

  const title = document.createElement('strong')
  title.textContent = point.name
  content.appendChild(title)

  if (point.typeLabel) {
    const type = document.createElement('p')
    type.textContent = point.typeLabel
    content.appendChild(type)
  }

  if (point.address) {
    const address = document.createElement('p')
    address.textContent = point.address
    content.appendChild(address)
  }

  if (point.phone) {
    appendContact(content, 'Phone: ', point.phone, phoneHref(point.phone))
  }

  if (point.email) {
    appendContact(content, 'Email: ', point.email, `mailto:${point.email}`)
  }

  if (point.website) {
    appendContact(content, 'Website: ', point.website, safeWebsiteURL(point.website))
  }

  return content
}

export default function ServicePointsMap({ points }: { points: ServicePointMarkerData[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  const hasValidCoordinates = points.some(
    (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
  )
  const configurationError = !styleURL
    ? 'The map is not configured. Set NEXT_PUBLIC_MAP_STYLE_URL to a MapLibre style URL.'
    : !hasValidCoordinates
      ? 'No service points with valid coordinates can be shown on the map.'
      : null

  useEffect(() => {
    if (configurationError) {
      return
    }

    const container = containerRef.current

    if (!container) {
      return
    }

    const mapContainer: HTMLDivElement = container
    const validPoints = points.filter(
      (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
    )

    let disposed = false
    let map: MapLibreMap | null = null
    const markers: MapLibreMarker[] = []

    function init(): void {
      try {
        if (disposed) {
          return
        }

        // Turbopack's generated worker URL 404s in this project. The worker
        // is copied to `public/` by scripts/copy-maplibre-worker.mjs.
        maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')

        map = new maplibregl.Map({
          container: mapContainer,
          style: styleURL,
          center: [validPoints[0].longitude, validPoints[0].latitude],
          zoom: validPoints.length === 1 ? 12 : 2,
          attributionControl: { compact: true },
        })

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

        const bounds = new maplibregl.LngLatBounds()

        for (const point of validPoints) {
          const element = document.createElement('button')
          element.type = 'button'
          element.className = styles.marker
          element.setAttribute('aria-label', `Show details for ${point.name}`)

          const marker = new maplibregl.Marker({ element })
            .setLngLat([point.longitude, point.latitude])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setDOMContent(createPopupContent(point)))
            .addTo(map)

          markers.push(marker)
          bounds.extend(new maplibregl.LngLat(point.longitude, point.latitude))
        }

        map.once('load', () => map?.resize())

        if (validPoints.length > 1) {
          map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: 0 })
        }
      } catch {
        if (!disposed) {
          setError('The map could not be loaded. The list below still shows every service point.')
        }
      }
    }

    init()

    return () => {
      disposed = true

      for (const marker of markers) {
        marker.remove()
      }

      if (map) {
        try {
          map.remove()
        } catch {
          // The map may already have been removed by a development remount.
        }
      }
    }
  }, [points, configurationError])

  const message = configurationError ?? error

  if (message) {
    return (
      <p className={styles.mapError} role="alert">
        {message}
      </p>
    )
  }

  return (
    <div className={styles.mapFrame}>
      <div
        ref={containerRef}
        className={styles.map}
        role="region"
        aria-label="Service points map"
      />
    </div>
  )
}
