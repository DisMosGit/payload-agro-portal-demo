import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { ServicePoint, User } from '@/payload-types'

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let payload: Payload
let adminUser: User
let first: ServicePoint
let second: ServicePoint
const createdIds: (number | string)[] = []

const pointData = (name: string, latitude: number, longitude: number) => ({
  name,
  type: 'dealer' as const,
  latitude,
  longitude,
  address: `Address for ${name}`,
})

describe('service points access control', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    first = await payload.create({
      collection: 'service-points',
      data: pointData(`Access fixture A ${unique}`, 52.2297, 21.0122),
    })
    second = await payload.create({
      collection: 'service-points',
      data: pointData(`Access fixture B ${unique}`, 50.0647, 19.945),
    })
    createdIds.push(first.id, second.id)

    adminUser = await payload.create({
      collection: 'users',
      data: { email: `service-points-admin-${unique}@example.com`, password: 'test' },
    })
  })

  afterAll(async () => {
    for (const id of createdIds) {
      await payload.delete({ collection: 'service-points', id }).catch(() => undefined)
    }

    if (adminUser) {
      await payload.delete({ collection: 'users', id: adminUser.id }).catch(() => undefined)
    }
  })

  it('lets an anonymous caller read every seeded point', async () => {
    const result = await payload.find({
      collection: 'service-points',
      where: { id: { in: [first.id, second.id] } },
      overrideAccess: false,
    })

    expect(result.docs).toHaveLength(2)
    expect(result.docs.map((doc) => doc.id).sort()).toEqual([first.id, second.id].sort())
  })

  it('rejects an anonymous create and stores nothing', async () => {
    const name = `Anonymous point ${unique}`

    await expect(
      payload.create({
        collection: 'service-points',
        data: pointData(name, 51.1079, 17.0385),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const result = await payload.find({
      collection: 'service-points',
      where: { name: { equals: name } },
    })
    expect(result.docs).toHaveLength(0)
  })

  it('rejects an anonymous update and leaves the point unchanged', async () => {
    await expect(
      payload.update({
        collection: 'service-points',
        id: first.id,
        data: { name: 'Hijacked point' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const unchanged = await payload.findByID({ collection: 'service-points', id: first.id })
    expect(unchanged.name).toBe(first.name)
  })

  it('rejects an anonymous delete and leaves the point in place', async () => {
    await expect(
      payload.delete({
        collection: 'service-points',
        id: first.id,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const stillThere = await payload.findByID({ collection: 'service-points', id: first.id })
    expect(stillThere.name).toBe(first.name)
  })

  it('allows an authenticated administrator to create, update, and delete', async () => {
    const created = await payload.create({
      collection: 'service-points',
      data: pointData(`Admin point ${unique}`, 51.1079, 17.0385),
      user: adminUser,
      overrideAccess: false,
    })
    createdIds.push(created.id)

    expect(created.name).toBe(`Admin point ${unique}`)

    const updated = await payload.update({
      collection: 'service-points',
      id: created.id,
      data: { name: `Admin point edited ${unique}` },
      user: adminUser,
      overrideAccess: false,
    })
    expect(updated.name).toBe(`Admin point edited ${unique}`)

    await payload.delete({
      collection: 'service-points',
      id: created.id,
      user: adminUser,
      overrideAccess: false,
    })

    const gone = await payload.find({
      collection: 'service-points',
      where: { id: { equals: created.id } },
    })
    expect(gone.docs).toHaveLength(0)
  })

  it('rejects out-of-range coordinates', async () => {
    await expect(
      payload.create({
        collection: 'service-points',
        data: pointData(`Bad latitude ${unique}`, 91, 21),
        user: adminUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.create({
        collection: 'service-points',
        data: pointData(`Bad longitude ${unique}`, 52, 181),
        user: adminUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const result = await payload.find({
      collection: 'service-points',
      where: {
        or: [
          { name: { equals: `Bad latitude ${unique}` } },
          { name: { equals: `Bad longitude ${unique}` } },
        ],
      },
    })
    expect(result.docs).toHaveLength(0)
  })

  it('accepts the coordinate boundaries', async () => {
    const northEast = await payload.create({
      collection: 'service-points',
      data: pointData(`Boundary north-east ${unique}`, 90, 180),
      user: adminUser,
      overrideAccess: false,
    })
    const southWest = await payload.create({
      collection: 'service-points',
      data: pointData(`Boundary south-west ${unique}`, -90, -180),
      user: adminUser,
      overrideAccess: false,
    })
    createdIds.push(northEast.id, southWest.id)

    expect(northEast.latitude).toBe(90)
    expect(northEast.longitude).toBe(180)
    expect(southWest.latitude).toBe(-90)
    expect(southWest.longitude).toBe(-180)
  })
})
