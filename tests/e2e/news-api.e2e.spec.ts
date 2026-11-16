import { expect, test } from '@playwright/test'

import {
  cleanupNewsItems,
  getNewsPayload,
  newsBody,
  seedNewsItems,
  type SeededNews,
} from '../helpers/seedNews'

const baseURL = 'http://localhost:3000'

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `news-api-${unique}@example.com`
const adminPassword = 'test'
const attemptedSlug = `api-attempt-${unique}`

let seeded: SeededNews
let adminUserId: number | string | undefined

test.describe('News REST API authorization', () => {
  test.beforeAll(async () => {
    seeded = await seedNewsItems()

    const payload = await getNewsPayload()
    const user = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: adminPassword },
    })

    adminUserId = user.id
  })

  test.afterAll(async () => {
    if (seeded) {
      await cleanupNewsItems(seeded)
    }

    if (adminUserId !== undefined) {
      const payload = await getNewsPayload()
      await payload.delete({ collection: 'users', id: adminUserId }).catch(() => undefined)
    }
  })

  test('public reads expose only published items', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/news?limit=100`)
    expect(response.status()).toBe(200)

    const body = await response.json()
    const slugs = body.docs.map((doc: { slug: string }) => doc.slug)

    expect(slugs).toContain(seeded.published.slug)
    expect(slugs).not.toContain(seeded.draft.slug)
  })

  test('rejects unauthenticated create, update, and delete without changing data', async ({
    request,
  }) => {
    const payload = await getNewsPayload()

    const createResponse = await request.post(`${baseURL}/api/news`, {
      data: {
        title: 'Anonymous attempt',
        slug: attemptedSlug,
        body: newsBody('Anonymous attempt body'),
        publishedAt: new Date().toISOString(),
        _status: 'published',
      },
    })
    expect([401, 403]).toContain(createResponse.status())

    const updateResponse = await request.patch(`${baseURL}/api/news/${seeded.published.id}`, {
      data: { title: 'Hijacked title' },
    })
    expect([401, 403]).toContain(updateResponse.status())

    const deleteResponse = await request.delete(`${baseURL}/api/news/${seeded.published.id}`)
    expect([401, 403]).toContain(deleteResponse.status())

    const attempted = await payload.find({
      collection: 'news',
      where: { slug: { equals: attemptedSlug } },
    })
    expect(attempted.docs).toHaveLength(0)

    const stillThere = await payload.find({
      collection: 'news',
      where: { slug: { equals: seeded.published.slug } },
    })
    expect(stillThere.docs).toHaveLength(1)
    expect(stillThere.docs[0].title).toBe(seeded.published.title)
  })

  test('allows an authenticated administrator to create and delete', async ({ playwright }) => {
    const authenticated = await playwright.request.newContext()

    try {
      const loginResponse = await authenticated.post(`${baseURL}/api/users/login`, {
        data: { email: adminEmail, password: adminPassword },
      })
      expect(loginResponse.ok()).toBeTruthy()

      const createResponse = await authenticated.post(`${baseURL}/api/news`, {
        data: {
          title: `Authenticated API create ${unique}`,
          slug: `api-admin-${unique}`,
          body: newsBody(`Authenticated API body ${unique}`),
          publishedAt: new Date().toISOString(),
          _status: 'published',
        },
      })
      expect([200, 201]).toContain(createResponse.status())

      const created = await createResponse.json()
      expect(created.doc.slug).toBe(`api-admin-${unique}`)

      const deleteResponse = await authenticated.delete(`${baseURL}/api/news/${created.doc.id}`)
      expect(deleteResponse.status()).toBe(200)
    } finally {
      await authenticated.dispose()
    }
  })
})
