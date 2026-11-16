import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import { cleanupNewsItems, newsBody, seedNewsItems, type SeededNews } from '../helpers/seedNews'

let payload: Payload
let seeded: SeededNews
let adminEmail: string
let adminUser: User

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe('news access control', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    seeded = await seedNewsItems(payload)

    adminEmail = `news-admin-${unique}@example.com`
    adminUser = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: 'test' },
    })
  })

  afterAll(async () => {
    if (seeded) {
      await cleanupNewsItems(seeded, payload)
    }

    if (adminUser) {
      await payload.delete({ collection: 'users', id: adminUser.id })
    }
  })

  it('seeds one published item and one draft item', async () => {
    const published = await payload.findByID({ collection: 'news', id: seeded.published.id })
    const draft = await payload.findByID({ collection: 'news', id: seeded.draft.id, draft: true })

    expect(published._status).toBe('published')
    expect(draft._status).toBe('draft')
    expect(seeded.draft.slug).not.toBe(seeded.published.slug)
  })

  it('returns only published items to an anonymous caller', async () => {
    const result = await payload.find({
      collection: 'news',
      where: {
        slug: { in: [seeded.published.slug, seeded.draft.slug] },
      },
      overrideAccess: false,
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0].slug).toBe(seeded.published.slug)
  })

  it('does not leak drafts even when an anonymous caller asks for drafts', async () => {
    const result = await payload.find({
      collection: 'news',
      where: {
        slug: { in: [seeded.published.slug, seeded.draft.slug] },
      },
      draft: true,
      overrideAccess: false,
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0].slug).toBe(seeded.published.slug)
  })

  it('returns nothing for a draft slug lookup', async () => {
    const result = await payload.find({
      collection: 'news',
      where: { slug: { equals: seeded.draft.slug } },
      overrideAccess: false,
    })

    expect(result.docs).toHaveLength(0)
  })

  it('returns drafts and published items to an authenticated administrator', async () => {
    const result = await payload.find({
      collection: 'news',
      where: {
        slug: { in: [seeded.published.slug, seeded.draft.slug] },
      },
      draft: true,
      user: adminUser,
      overrideAccess: false,
    })

    expect(result.docs).toHaveLength(2)
  })

  it('rejects an anonymous create', async () => {
    await expect(
      payload.create({
        collection: 'news',
        data: {
          title: 'Anonymous attempt',
          slug: `anonymous-attempt-${unique}`,
          body: newsBody('Anonymous attempt body'),
          publishedAt: new Date().toISOString(),
          _status: 'published',
        },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const result = await payload.find({
      collection: 'news',
      where: { slug: { equals: `anonymous-attempt-${unique}` } },
    })
    expect(result.docs).toHaveLength(0)
  })

  it('rejects an anonymous update and leaves the item unchanged', async () => {
    await expect(
      payload.update({
        collection: 'news',
        id: seeded.published.id,
        data: { title: 'Hijacked title' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const unchanged = await payload.findByID({
      collection: 'news',
      id: seeded.published.id,
    })
    expect(unchanged.title).toBe(seeded.published.title)
  })

  it('rejects an anonymous delete and leaves the item in place', async () => {
    await expect(
      payload.delete({
        collection: 'news',
        id: seeded.published.id,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const stillThere = await payload.findByID({
      collection: 'news',
      id: seeded.published.id,
    })
    expect(stillThere.slug).toBe(seeded.published.slug)
  })

  it('allows an authenticated administrator to create', async () => {
    const slug = `admin-create-${unique}`
    const created = await payload.create({
      collection: 'news',
      data: {
        title: 'Authenticated create',
        slug,
        body: newsBody('Authenticated create body'),
        publishedAt: new Date().toISOString(),
        _status: 'published',
      },
      user: adminUser,
      overrideAccess: false,
    })

    expect(created.id).toBeDefined()
    expect(created.slug).toBe(slug)

    await payload.delete({
      collection: 'news',
      id: created.id,
      user: adminUser,
      overrideAccess: false,
    })
  })
})
