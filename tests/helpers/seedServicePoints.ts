import type { Payload } from 'payload'
import { getPayload } from 'payload'

import type { ServicePoint } from '@/payload-types'
import config from '../../src/payload.config.js'

export type ServicePointInput = Omit<ServicePoint, 'id' | 'createdAt' | 'updatedAt'>

export interface SeededServicePoints {
  suffix: string
  points: ServicePoint[]
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function getServicePointsPayload(): Promise<Payload> {
  const payloadConfig = await config

  return getPayload({ config: payloadConfig })
}

/**
 * Creates two points with a per-run suffix in their names. Cleanup selects by
 * that suffix, so a test never deletes points it did not create.
 */
export async function seedServicePoints(): Promise<SeededServicePoints> {
  const payload = await getServicePointsPayload()
  const suffix = uniqueSuffix()

  const inputs: ServicePointInput[] = [
    {
      name: `Dealer fixture ${suffix}`,
      type: 'dealer',
      latitude: 52.2297,
      longitude: 21.0122,
      address: `Dealer Street 1, ${suffix}`,
      phone: '+48 111 222 333',
      email: `dealer-${suffix}@example.com`,
      website: 'https://example.com/dealer',
    },
    {
      name: `Warehouse fixture ${suffix}`,
      type: 'warehouse',
      latitude: 50.0647,
      longitude: 19.945,
      address: `Warehouse Street 2, ${suffix}`,
      phone: '+48 444 555 666',
      email: `warehouse-${suffix}@example.com`,
    },
  ]

  const points: ServicePoint[] = []

  for (const data of inputs) {
    points.push(await payload.create({ collection: 'service-points', data }))
  }

  return { suffix, points }
}

export async function cleanupServicePoints(seed: SeededServicePoints): Promise<void> {
  if (!seed) {
    return
  }

  const payload = await getServicePointsPayload()
  const { docs } = await payload.find({
    collection: 'service-points',
    where: { name: { like: seed.suffix } },
    pagination: false,
    depth: 0,
  })

  for (const doc of docs) {
    await payload.delete({ collection: 'service-points', id: doc.id }).catch(() => undefined)
  }
}

export async function snapshotServicePoints(): Promise<ServicePointInput[]> {
  const payload = await getServicePointsPayload()
  const { docs } = await payload.find({
    collection: 'service-points',
    pagination: false,
    depth: 0,
    sort: 'id',
  })

  return docs.map((point) => ({
    name: point.name,
    type: point.type ?? null,
    latitude: point.latitude,
    longitude: point.longitude,
    address: point.address ?? null,
    phone: point.phone ?? null,
    email: point.email ?? null,
    website: point.website ?? null,
    notes: point.notes ?? null,
  }))
}

export async function deleteAllServicePoints(): Promise<void> {
  const payload = await getServicePointsPayload()
  const { docs } = await payload.find({
    collection: 'service-points',
    pagination: false,
    depth: 0,
  })

  for (const doc of docs) {
    await payload.delete({ collection: 'service-points', id: doc.id }).catch(() => undefined)
  }
}

export async function restoreServicePoints(snapshot: ServicePointInput[]): Promise<void> {
  const payload = await getServicePointsPayload()

  for (const data of snapshot) {
    await payload.create({ collection: 'service-points', data })
  }
}
