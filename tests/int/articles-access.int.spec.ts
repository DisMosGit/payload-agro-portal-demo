// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import {
  articleRichText,
  cleanupArticles,
  seedArticles,
  uniqueArticleSlug,
  type SeededArticles,
} from '../helpers/seedArticles'

let payload: Payload
let seeded: SeededArticles
let adminUser: User

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `articles-admin-${unique}@example.com`

function minimalArticle(slug: string, title: string) {
  return {
    title,
    slug,
    summary: `Summary for ${title}`,
    authorName: 'Demo Agronomist',
    publishedAt: new Date().toISOString(),
    tags: [{ tag: 'access-test' }],
    content: [
      {
        blockType: 'section' as const,
        heading: 'Access test section',
        level: 'h2' as const,
        body: articleRichText(`Access test body for ${title}`),
      },
    ],
    _status: 'published' as const,
  }
}

describe('article access control', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    seeded = await seedArticles(payload)

    adminUser = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: 'test' },
    })
  })

  afterAll(async () => {
    if (seeded) {
      await cleanupArticles(seeded, payload)
    }

    if (adminUser) {
      await payload.delete({ collection: 'users', id: adminUser.id })
    }
  })

  const allSlugs = () => [
    seeded.published.slug,
    seeded.related.slug,
    seeded.draft.slug,
    seeded.future.slug,
    seeded.scheduled.slug,
  ]

  it('seeds published, related, draft, future-dated, and scheduled articles', async () => {
    const published = await payload.findByID({
      collection: 'articles',
      id: seeded.published.id,
    })
    const draft = await payload.findByID({
      collection: 'articles',
      id: seeded.draft.id,
      draft: true,
    })
    const future = await payload.findByID({
      collection: 'articles',
      id: seeded.future.id,
    })
    const scheduled = await payload.findByID({
      collection: 'articles',
      id: seeded.scheduled.id,
      draft: true,
    })

    expect(published._status).toBe('published')
    expect(draft._status).toBe('draft')
    expect(future.publishedAt).toBeTruthy()
    expect(scheduled._status).toBe('draft')
  })

  it('returns only due published articles to an anonymous caller', async () => {
    const result = await payload.find({
      collection: 'articles',
      where: { slug: { in: allSlugs() } },
      overrideAccess: false,
      pagination: false,
    })

    expect(result.docs.map((doc) => doc.slug).sort()).toEqual(
      [seeded.published.slug, seeded.related.slug].sort(),
    )
  })

  it('does not leak drafts even when an anonymous caller asks for drafts', async () => {
    const result = await payload.find({
      collection: 'articles',
      where: { slug: { in: allSlugs() } },
      draft: true,
      overrideAccess: false,
      pagination: false,
    })

    const slugs = result.docs.map((doc) => doc.slug)

    expect(slugs).toContain(seeded.published.slug)
    expect(slugs).toContain(seeded.related.slug)
    expect(slugs).not.toContain(seeded.draft.slug)
    expect(slugs).not.toContain(seeded.future.slug)
    expect(slugs).not.toContain(seeded.scheduled.slug)
  })

  it('hides a future-dated published article before its publication time', async () => {
    const result = await payload.find({
      collection: 'articles',
      where: { slug: { equals: seeded.future.slug } },
      overrideAccess: false,
    })

    expect(result.docs).toHaveLength(0)
  })

  it('returns no result for draft and scheduled slug lookups', async () => {
    for (const slug of [seeded.draft.slug, seeded.scheduled.slug]) {
      const result = await payload.find({
        collection: 'articles',
        where: { slug: { equals: slug } },
        overrideAccess: false,
      })

      expect(result.docs).toHaveLength(0)
    }
  })

  it('returns drafts, scheduled, and published articles to an authenticated administrator', async () => {
    const result = await payload.find({
      collection: 'articles',
      where: { slug: { in: allSlugs() } },
      draft: true,
      user: adminUser,
      overrideAccess: false,
      pagination: false,
    })

    expect(result.docs).toHaveLength(5)
  })

  it('rejects an anonymous create and stores nothing', async () => {
    const slug = uniqueArticleSlug('anonymous-article')

    await expect(
      payload.create({
        collection: 'articles',
        data: minimalArticle(slug, 'Anonymous article attempt'),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const result = await payload.find({
      collection: 'articles',
      where: { slug: { equals: slug } },
    })

    expect(result.docs).toHaveLength(0)
  })

  it('rejects an anonymous update and leaves the article unchanged', async () => {
    await expect(
      payload.update({
        collection: 'articles',
        id: seeded.published.id,
        data: { title: 'Hijacked article title' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const unchanged = await payload.findByID({
      collection: 'articles',
      id: seeded.published.id,
    })

    expect(unchanged.title).toBe(seeded.published.title)
  })

  it('rejects an anonymous delete and leaves the article in place', async () => {
    await expect(
      payload.delete({
        collection: 'articles',
        id: seeded.published.id,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const stillThere = await payload.findByID({
      collection: 'articles',
      id: seeded.published.id,
    })

    expect(stillThere.slug).toBe(seeded.published.slug)
  })

  it('rejects a duplicate slug within articles', async () => {
    await expect(
      payload.create({
        collection: 'articles',
        data: minimalArticle(seeded.published.slug, 'Duplicate slug article'),
        user: adminUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('allows an authenticated administrator to create, update, and delete', async () => {
    const slug = uniqueArticleSlug('admin-article')
    const created = await payload.create({
      collection: 'articles',
      data: minimalArticle(slug, 'Authenticated article create'),
      user: adminUser,
      overrideAccess: false,
    })

    expect(created.id).toBeDefined()
    expect(created.slug).toBe(slug)

    const updated = await payload.update({
      collection: 'articles',
      id: created.id,
      data: { title: 'Authenticated article updated' },
      user: adminUser,
      overrideAccess: false,
    })

    expect(updated.title).toBe('Authenticated article updated')

    await payload.delete({
      collection: 'articles',
      id: created.id,
      user: adminUser,
      overrideAccess: false,
    })

    const gone = await payload.find({
      collection: 'articles',
      where: { slug: { equals: slug } },
    })

    expect(gone.docs).toHaveLength(0)
  })
})
