import { expect, test } from '@playwright/test'

import {
  cleanupNewsItems,
  getNewsPayload,
  newsBody,
  seedNewsItems,
  uniqueNewsSlug,
  type SeededNews,
} from '../helpers/seedNews'

const baseURL = 'http://localhost:3000'

let seeded: SeededNews
let older: { id: number; slug: string; title: string }

test.describe('Public news section', () => {
  test.beforeAll(async () => {
    seeded = await seedNewsItems()

    // A second, older published item lets the list order be asserted.
    const payload = await getNewsPayload()
    const slug = uniqueNewsSlug('older-fixture')
    const created = await payload.create({
      collection: 'news',
      data: {
        title: `Older fixture ${slug}`,
        slug,
        listingDescription: `Older listing description ${slug}`,
        body: newsBody(`Older fixture body ${slug}`),
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        _status: 'published',
      },
    })

    older = { id: created.id, slug, title: created.title }
  })

  test.afterAll(async () => {
    if (older) {
      const payload = await getNewsPayload()
      await payload.delete({ collection: 'news', id: older.id }).catch(() => undefined)
    }

    if (seeded) {
      await cleanupNewsItems(seeded)
    }
  })

  test('lists published news with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const response = await page.goto(`${baseURL}/news`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { level: 1, name: 'News' })).toBeVisible()

    const card = page
      .locator('article')
      .filter({ has: page.locator(`a[href="/news/${seeded.published.slug}"]`) })

    await expect(card).toHaveCount(1)
    await expect(card).toContainText(seeded.published.title)
    await expect(card).toContainText(`Listing description for ${seeded.published.slug}`)
    await expect(card.locator('time')).toHaveAttribute('datetime', /.+/)

    // Newest publication date first.
    const hrefs = await page
      .locator('article a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
    const publishedIndex = hrefs.indexOf(`/news/${seeded.published.slug}`)
    const olderIndex = hrefs.indexOf(`/news/${older.slug}`)
    expect(publishedIndex).toBeGreaterThanOrEqual(0)
    expect(olderIndex).toBeGreaterThan(publishedIndex)

    // The draft is not part of the public list.
    await expect(page.getByText(seeded.draft.title, { exact: false })).toHaveCount(0)

    const html = await page.content()
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('href="/admin"')
    expect(html).not.toMatch(/>\s*(Edit|Delete)\s*</)

    await context.close()
  })

  test('renders a published item with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const response = await page.goto(`${baseURL}/news/${seeded.published.slug}`)
    expect(response?.status()).toBe(200)

    await expect(page.locator('h1')).toHaveText(seeded.published.title)
    await expect(page.locator('article')).toContainText(seeded.published.bodyText)
    await expect(page).toHaveTitle(seeded.published.title)
    await expect(page.locator('a[href="/news"]')).toHaveCount(1)

    const html = await page.content()
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('href="/admin"')
    expect(html).not.toMatch(/>\s*(Edit|Delete)\s*</)

    await context.close()
  })

  test('returns 404 for draft and unknown slugs', async ({ request }) => {
    const draft = await request.get(`${baseURL}/news/${seeded.draft.slug}`)
    expect(draft.status()).toBe(404)

    const unknown = await request.get(`${baseURL}/news/no-such-news-item`)
    expect(unknown.status()).toBe(404)
  })
})
