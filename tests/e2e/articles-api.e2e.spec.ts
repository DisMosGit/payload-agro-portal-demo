import { expect, test } from '@playwright/test'

import {
  articleRichText,
  cleanupArticles,
  getArticlesPayload,
  seedArticles,
  uniqueArticleSlug,
  type SeededArticles,
} from '../helpers/seedArticles'

const baseURL = 'http://localhost:3000'
const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `articles-api-${unique}@example.com`
const adminPassword = 'test'
const attemptedSlug = `api-article-attempt-${unique}`

let seeded: SeededArticles
let adminUserID: number | string | undefined

function apiArticle(slug: string, title: string) {
  return {
    title,
    slug,
    summary: `Summary for ${title}`,
    authorName: 'Demo Agronomist',
    publishedAt: new Date().toISOString(),
    tags: [{ tag: 'api-test' }],
    content: [
      {
        blockType: 'section',
        heading: 'API test section',
        level: 'h2',
        body: articleRichText(`API test body for ${title}`),
      },
    ],
    _status: 'published',
  }
}

test.describe('Articles REST API authorization', () => {
  test.beforeAll(async () => {
    seeded = await seedArticles()
    const payload = await getArticlesPayload()
    const user = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: adminPassword },
    })

    adminUserID = user.id
  })

  test.afterAll(async () => {
    if (seeded) {
      await cleanupArticles(seeded)
    }

    if (adminUserID !== undefined) {
      const payload = await getArticlesPayload()
      await payload.delete({ collection: 'users', id: adminUserID }).catch(() => undefined)
    }
  })

  test('public reads expose only due published articles', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/articles?limit=100`)
    expect(response.status()).toBe(200)

    const body = await response.json()
    const slugs: string[] = body.docs.map((doc: { slug: string }) => doc.slug)

    expect(slugs).toContain(seeded.published.slug)
    expect(slugs).toContain(seeded.related.slug)
    expect(slugs).not.toContain(seeded.draft.slug)
    expect(slugs).not.toContain(seeded.future.slug)
    expect(slugs).not.toContain(seeded.scheduled.slug)
  })

  test('rejects unauthenticated create, update, and delete without changing data', async ({
    request,
  }) => {
    const payload = await getArticlesPayload()

    const createResponse = await request.post(`${baseURL}/api/articles`, {
      data: apiArticle(attemptedSlug, 'Anonymous API article'),
    })
    expect([401, 403]).toContain(createResponse.status())

    const updateResponse = await request.patch(`${baseURL}/api/articles/${seeded.published.id}`, {
      data: { title: 'Hijacked API title' },
    })
    expect([401, 403]).toContain(updateResponse.status())

    const deleteResponse = await request.delete(`${baseURL}/api/articles/${seeded.published.id}`)
    expect([401, 403]).toContain(deleteResponse.status())

    const attempted = await payload.find({
      collection: 'articles',
      where: { slug: { equals: attemptedSlug } },
    })
    expect(attempted.docs).toHaveLength(0)

    const stillThere = await payload.findByID({
      collection: 'articles',
      id: seeded.published.id,
    })
    expect(stillThere.title).toBe(seeded.published.title)
  })

  test('allows an authenticated administrator to create and delete', async ({ playwright }) => {
    const authenticated = await playwright.request.newContext()

    try {
      const loginResponse = await authenticated.post(`${baseURL}/api/users/login`, {
        data: { email: adminEmail, password: adminPassword },
      })
      expect(loginResponse.ok()).toBeTruthy()

      const slug = uniqueArticleSlug('api-admin-article')
      const createResponse = await authenticated.post(`${baseURL}/api/articles`, {
        data: apiArticle(slug, `Authenticated API article ${unique}`),
      })
      expect([200, 201]).toContain(createResponse.status())

      const created = await createResponse.json()
      expect(created.doc.slug).toBe(slug)

      const deleteResponse = await authenticated.delete(`${baseURL}/api/articles/${created.doc.id}`)
      expect(deleteResponse.status()).toBe(200)
    } finally {
      await authenticated.dispose()
    }
  })
})
