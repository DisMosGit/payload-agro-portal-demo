import { expect, test } from '@playwright/test'

import {
  articleRichText,
  cleanupArticleRefs,
  cleanupArticles,
  getArticlesPayload,
  seedArticleAssets,
  seedArticles,
  seedPaginationArticles,
  uniqueArticleSlug,
  type ArticleRef,
  type SeededArticles,
} from '../helpers/seedArticles'

const baseURL = 'http://localhost:3000'

let seeded: SeededArticles
let pagination: ArticleRef[] = []

test.describe('Public articles section', () => {
  test.setTimeout(180_000)

  test.beforeAll(async () => {
    seeded = await seedArticles()
    const payload = await getArticlesPayload()
    pagination = await seedPaginationArticles(payload, 10)
  })

  test.afterAll(async () => {
    if (pagination.length > 0) {
      await cleanupArticleRefs(pagination)
    }

    if (seeded) {
      await cleanupArticles(seeded)
    }
  })

  test('lists published articles newest first with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    const youtubeRequests: string[] = []

    page.on('request', (request) => {
      if (request.url().includes('youtube')) {
        youtubeRequests.push(request.url())
      }
    })

    const response = await page.goto(`${baseURL}/articles`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { level: 1, name: 'Articles' })).toBeVisible()

    const card = page
      .locator('article')
      .filter({ has: page.locator(`a[href="/articles/${seeded.published.slug}"]`) })

    await expect(card).toHaveCount(1)
    await expect(card).toContainText(seeded.published.title)
    await expect(card).toContainText(`Summary for ${seeded.published.slug}`)
    await expect(card).toContainText('Demo Agronomist')
    await expect(card).toContainText(/\d+ min read/)
    await expect(card).toContainText('soil-health')
    await expect(card.locator('img')).toHaveCount(1)
    await expect(card.getByText('3:45')).toBeVisible()

    const hrefs = await page
      .locator('article a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
    const publishedIndex = hrefs.indexOf(`/articles/${seeded.published.slug}`)
    const relatedIndex = hrefs.indexOf(`/articles/${seeded.related.slug}`)
    expect(publishedIndex).toBeGreaterThanOrEqual(0)
    expect(relatedIndex).toBeGreaterThan(publishedIndex)

    await expect(page.getByText(seeded.draft.title, { exact: false })).toHaveCount(0)
    await expect(page.getByText(seeded.future.title, { exact: false })).toHaveCount(0)
    await expect(page.getByText(seeded.scheduled.title, { exact: false })).toHaveCount(0)

    expect(youtubeRequests).toEqual([])

    const html = await page.content()
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('href="/admin"')
    expect(html).not.toMatch(/>\s*(Edit|Delete)\s*</)
    expect(html).not.toContain('youtube.com/embed')

    await context.close()
  })

  test('renders a published article with every block and JavaScript disabled', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const response = await page.goto(`${baseURL}/articles/${seeded.published.slug}`)
    expect(response?.status()).toBe(200)

    await expect(page.locator('h1')).toHaveText(seeded.published.title)
    await expect(page.getByText('By Demo Agronomist')).toBeVisible()
    await expect(page.locator('header').getByText(/\d+ min read/)).toBeVisible()
    await expect(page.getByText(`Summary for ${seeded.published.slug}`)).toBeVisible()

    const toc = page.locator('nav[aria-label="Table of contents"]')
    await expect(toc).toBeVisible()
    const tocHrefs = await toc
      .locator('a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
    expect(tocHrefs.length).toBeGreaterThanOrEqual(4)
    expect(new Set(tocHrefs).size).toBe(tocHrefs.length)

    for (const href of tocHrefs) {
      expect(href).toMatch(/^#/)
      await expect(page.locator(href as string)).toHaveCount(1)
    }

    await expect(page.locator('h2', { hasText: 'Why soil health matters' })).toBeVisible()
    await expect(page.getByText(seeded.published.bodyText)).toBeVisible()
    await expect(page.getByText('Field trial caption')).toBeVisible()
    await expect(page.locator('table caption')).toHaveText('Trial results')
    await expect(page.getByRole('cell', { name: 'Compost' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '+12%' })).toBeVisible()
    await expect(page.locator('aside[data-variant="warning"]')).toContainText('Before you apply')
    await expect(page.locator('section[aria-label="Image gallery"] img')).toHaveCount(2)

    const footnotes = page.locator('aside[aria-label="Footnotes"]')
    await expect(footnotes.locator('li')).toHaveCount(2)
    await expect(footnotes.locator('li').first()).toHaveAttribute('id', /^footnote-/)

    const download = page.getByRole('link', { name: 'Download the trial guide' })
    await expect(download).toHaveAttribute('download', seeded.assets.attachmentFilename)
    await expect(download).toHaveAttribute('href', /\/api\/article-attachments\/file\//)

    const related = page.locator('section[aria-label="Related articles"]')
    await expect(related).toContainText(seeded.related.title)

    await expect(page).toHaveTitle(`SEO ${seeded.published.slug}`)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${baseURL}/articles/${seeded.published.slug}`,
    )
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    )

    const html = await page.content()
    expect(html).toContain('&lt;script&gt;alert("article-xss")&lt;/script&gt;')
    expect(html).not.toContain('<script>alert("article-xss")</script>')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('href="/admin"')
    expect(html).not.toMatch(/>\s*(Edit|Delete)\s*</)

    await context.close()
  })

  test('returns 404 for draft, future-dated, scheduled, and unknown slugs', async ({ request }) => {
    for (const slug of [
      seeded.draft.slug,
      seeded.future.slug,
      seeded.scheduled.slug,
      'no-such-article',
    ]) {
      const response = await request.get(`${baseURL}/articles/${slug}`)
      expect(response.status()).toBe(404)
    }
  })

  test('paginates, shows an out-of-range empty state, and exposes no write controls', async ({
    page,
  }) => {
    const firstPage = await page.goto(`${baseURL}/articles`)
    expect(firstPage?.status()).toBe(200)
    await expect(page.locator('article')).toHaveCount(9)

    const secondPage = await page.goto(`${baseURL}/articles?page=2`)
    expect(secondPage?.status()).toBe(200)
    await expect(page.locator('article')).toHaveCount(3)
    await expect(page.getByRole('link', { name: '2', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )

    const outOfRange = await page.goto(`${baseURL}/articles?page=99`)
    expect(outOfRange?.status()).toBe(200)
    await expect(page.locator('article')).toHaveCount(0)
    await expect(page.getByText('No articles are available on page 99.')).toBeVisible()

    const html = await page.content()
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('href="/admin"')
  })

  test('stays readable when referenced media is deleted after publication', async ({ browser }) => {
    const payload = await getArticlesPayload()
    const assets = await seedArticleAssets(payload)
    const slug = uniqueArticleSlug('missing-media-article')
    const title = `Missing media article ${slug}`
    const bodyText = `Missing media body ${slug}`

    const article = await payload.create({
      collection: 'articles',
      data: {
        title,
        slug,
        summary: `Missing media summary ${slug}`,
        authorName: 'Demo Agronomist',
        publishedAt: new Date().toISOString(),
        heroImage: assets.heroImageId,
        content: [
          {
            blockType: 'section',
            heading: 'Missing media section',
            level: 'h2',
            body: articleRichText(bodyText),
          },
          {
            blockType: 'image',
            image: assets.heroImageId,
            caption: 'Missing hero caption',
            size: 'wide',
          },
          {
            blockType: 'gallery',
            images: [
              { image: assets.galleryImageId, caption: 'Missing gallery caption' },
              { image: assets.heroImageId, caption: 'Missing gallery caption two' },
            ],
          },
          {
            blockType: 'downloads',
            items: [{ file: assets.attachmentId, label: 'Missing media download' }],
          },
        ],
        _status: 'published',
      },
    })

    // Deleting an upload nulls the relationship, which is exactly the state a
    // published article can reach when an editor removes a file later.
    await payload.delete({ collection: 'media', id: assets.heroImageId })
    await payload.delete({ collection: 'media', id: assets.galleryImageId })
    await payload.delete({ collection: 'article-attachments', id: assets.attachmentId })

    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const response = await page.goto(`${baseURL}/articles/${slug}`)
    expect(response?.status()).toBe(200)

    await expect(page.locator('h1')).toHaveText(title)
    await expect(page.getByText(bodyText)).toBeVisible()
    await expect(page.locator('figure img')).toHaveCount(0)
    // One fallback for the image block and one for each gallery item.
    await expect(page.getByText('Image unavailable.')).toHaveCount(3)
    await expect(page.getByText('Missing hero caption')).toBeVisible()
    await expect(page.getByText('Download unavailable: Missing media download')).toBeVisible()

    const html = await page.content()
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<button')

    await context.close()

    await payload.delete({ collection: 'articles', id: article.id }).catch(() => undefined)
  })
})
