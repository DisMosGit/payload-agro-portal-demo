import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { ServicePoint } from '@/payload-types'
import { getServicePoints, toMarkerData } from '@/lib/service-points'

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let payload: Payload
let fullPoint: ServicePoint
let minimalPoint: ServicePoint
const fixtureIds: number[] = []

describe('service points public read helper', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Created out of alphabetical order so the sort assertion is meaningful.
    fullPoint = await payload.create({
      collection: 'service-points',
      data: {
        name: `Read fixture B ${unique}`,
        type: 'warehouse',
        latitude: 52.2297,
        longitude: 21.0122,
        address: 'Warehouse Street 1',
        phone: '+48 111 222 333',
        email: `warehouse-${unique}@example.com`,
        website: 'https://example.com/warehouse',
        notes: 'Internal note that must not reach the client marker data.',
      },
    })
    minimalPoint = await payload.create({
      collection: 'service-points',
      data: {
        name: `Read fixture A ${unique}`,
        latitude: 50.0647,
        longitude: 19.945,
      },
    })
    fixtureIds.push(fullPoint.id, minimalPoint.id)
  })

  afterAll(async () => {
    for (const id of fixtureIds) {
      await payload.delete({ collection: 'service-points', id }).catch(() => undefined)
    }
  })

  it('returns the seeded points sorted by name', async () => {
    const points = await getServicePoints()
    const fixtures = points.filter((point) => fixtureIds.includes(point.id))

    expect(fixtures.map((point) => point.id)).toEqual([minimalPoint.id, fullPoint.id])
    expect(fixtures.map((point) => point.name)).toEqual([minimalPoint.name, fullPoint.name])
  })

  it('serializes only the marker fields', () => {
    const marker = toMarkerData(fullPoint)

    expect(marker).toEqual({
      id: fullPoint.id,
      name: fullPoint.name,
      type: 'warehouse',
      typeLabel: 'Warehouse',
      latitude: 52.2297,
      longitude: 21.0122,
      address: 'Warehouse Street 1',
      phone: '+48 111 222 333',
      email: `warehouse-${unique}@example.com`,
      website: 'https://example.com/warehouse',
    })
    expect(marker).not.toHaveProperty('notes')
    expect(marker).not.toHaveProperty('createdAt')
    expect(marker).not.toHaveProperty('updatedAt')
  })

  it('maps absent optional details to null', () => {
    const marker = toMarkerData(minimalPoint)

    expect(marker.type).toBeNull()
    expect(marker.typeLabel).toBeNull()
    expect(marker.address).toBeNull()
    expect(marker.phone).toBeNull()
    expect(marker.email).toBeNull()
    expect(marker.website).toBeNull()
  })
})
