import { expect, test } from '@playwright/test'

import {
  articleRichText,
  cleanupArticleRefs,
  cleanupArticles,
  getArticlesPayload,
  seedArticles,
  uniqueArticleSlug,
  type ArticleRef,
  type SeededArticles,
} from '../helpers/seedArticles'

const baseURL = 'http://localhost:3000'

let seeded: SeededArticles
let alternative: ArticleRef

test.describe('Resilient article video', () => {
  test.setTimeout(180_000)

  test.beforeAll(async () => {
    seeded = await seedArticles()
    const payload = await getArticlesPayload()
    const slug = uniqueArticleSlug('alternative-video-article')
    const bodyText = `Alternative video article body ${slug}`
    const created = await payload.create({
      collection: 'articles',
      data: {
        title: `Alternative video article ${slug}`,
        slug,
        summary: `Alternative video summary ${slug}`,
        authorName: 'Demo Agronomist',
        publishedAt: new Date().toISOString(),
        video: {
          enabled: true,
          title: 'Direct source field clip',
          poster: seeded.assets.heroImageId,
          duration: '2:10',
          externalUrl: 'https://example.com/watch/alternative',
          alternativeSourceUrl: 'https://example.com/media/alternative.mp4',
          alternativeMimeType: 'video/mp4',
        },
        content: [
          {
            blockType: 'section',
            heading: 'Direct video section',
            level: 'h2',
            body: articleRichText(bodyText),
          },
        ],
        _status: 'published',
      },
    })

    alternative = { bodyText, id: created.id, slug, title: created.title }
  })

  test.afterAll(async () => {
    if (alternative) {
      await cleanupArticleRefs([alternative])
    }

    if (seeded) {
      await cleanupArticles(seeded)
    }
  })

  test('makes no YouTube request before the visitor activates the preview', async ({ page }) => {
    const youtubeRequests: string[] = []

    page.on('request', (request) => {
      if (request.url().includes('youtube')) {
        youtubeRequests.push(request.url())
      }
    })

    const response = await page.goto(`${baseURL}/articles/${seeded.published.slug}`)
    expect(response?.status()).toBe(200)

    await expect(page.locator('iframe')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Play video/ })).toBeVisible()
    await expect(page.getByText('3:45')).toBeVisible()
    expect(youtubeRequests).toEqual([])
  })

  test('keeps poster, duration, and fallback links when YouTube is blocked', async ({ page }) => {
    // A throttled or blocked request never completes, so the facade must hit
    // its timeout instead of waiting forever or navigating away.
    await page.route(/youtube/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 9_000))
      await route.abort().catch(() => undefined)
    })

    await page.goto(`${baseURL}/articles/${seeded.published.slug}`)
    await expect(page.locator('[data-video-facade]')).toHaveAttribute('data-hydrated', 'true')

    const externalLink = page.getByRole('link', { name: 'Watch externally' })
    const alternativeLink = page.getByRole('link', { name: 'Open alternative video source' })

    await expect(externalLink).toHaveAttribute('href', 'https://example.com/watch/field-trial')
    await expect(alternativeLink).toHaveAttribute(
      'href',
      'https://example.com/media/field-trial.mp4',
    )

    await page.getByRole('link', { name: /Play video/ }).click()

    await expect(page.locator('section[aria-label="Video"] [role="alert"]')).toContainText(
      'The video preview did not load',
      {
        timeout: 12_000,
      },
    )
    await expect(externalLink).toBeVisible()
    await expect(alternativeLink).toBeVisible()
    await expect(page.getByText('3:45')).toBeVisible()
    await expect(page.locator('img[alt^="Article hero asset-"]')).not.toHaveCount(0)
  })

  test('works without JavaScript and keeps the external and alternative links', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const response = await page.goto(`${baseURL}/articles/${seeded.published.slug}`)
    expect(response?.status()).toBe(200)

    await expect(page.locator('iframe')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Play video/ })).toHaveAttribute(
      'href',
      'https://example.com/watch/field-trial',
    )
    await expect(page.getByText('3:45')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Watch externally' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open alternative video source' })).toBeVisible()

    await context.close()
  })

  test('renders a native alternative source without YouTube', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const response = await page.goto(`${baseURL}/articles/${alternative.slug}`)
    expect(response?.status()).toBe(200)

    const video = page.locator('video[controls]')
    await expect(video).toHaveCount(1)
    await expect(video.locator('source')).toHaveAttribute(
      'src',
      'https://example.com/media/alternative.mp4',
    )
    await expect(video).toHaveAttribute('poster', /\/api\/media\/file\//)
    await expect(page.getByText('2:10')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Watch externally' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open alternative video source' })).toBeVisible()

    await context.close()
  })
})
