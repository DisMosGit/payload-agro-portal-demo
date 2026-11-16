import { getPayload } from 'payload'
import { cache } from 'react'

import type { ServicePoint } from '@/payload-types'
import config from '@payload-config'

/**
 * Public service point reads.
 *
 * `overrideAccess: false` is deliberate: the collection's public `read` rule
 * must run for this query. There is no draft state, and no page-level filter
 * may stand in for access control.
 */
export const getServicePoints = cache(async (): Promise<ServicePoint[]> => {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'service-points',
    overrideAccess: false,
    depth: 0,
    pagination: false,
    sort: 'name',
  })

  return docs
})

export const servicePointTypeLabels: Record<string, string> = {
  dealer: 'Dealer',
  'service-centre': 'Service centre',
  warehouse: 'Warehouse',
}

export function servicePointTypeLabel(type: ServicePoint['type']): string | null {
  if (!type) {
    return null
  }

  return servicePointTypeLabels[type] ?? type
}

/**
 * The serializable shape handed to the client map. Keep it free of Payload
 * internals and `Date` values, and keep `latitude`/`longitude` separate: the
 * single `[longitude, latitude]` conversion happens in the map component.
 */
export interface ServicePointMarkerData {
  id: number
  name: string
  type: ServicePoint['type']
  typeLabel: string | null
  latitude: number
  longitude: number
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
}

export function toMarkerData(point: ServicePoint): ServicePointMarkerData {
  return {
    id: point.id,
    name: point.name,
    type: point.type ?? null,
    typeLabel: servicePointTypeLabel(point.type),
    latitude: point.latitude,
    longitude: point.longitude,
    address: point.address ?? null,
    phone: point.phone ?? null,
    email: point.email ?? null,
    website: point.website ?? null,
  }
}
