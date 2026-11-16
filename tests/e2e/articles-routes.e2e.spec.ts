import { expect, test } from '@playwright/test'

import { articleRichText, getArticlesPayload, uniqueArticleSlug } from '../helpers/seedArticles'
import { getNewsPayload, newsBody } from '../helpers/seedNews'

const baseURL = 'http://localhost:3000'

const sharedSlug = uniqueArticleSlug('shared-slug')
const articleTitle = `Route isolation article ${sharedSlug}`
const articleBody = `Route isolation article body ${sharedSlug}`
const newsTitle = `Route isolation news ${sharedSlug}`
const newsBodyText = `Route isolation news body ${sharedSlug}`

let articleID: number | undefined
let newsID: number | undefined

test.describe('Article and news URL isolation', () => {
  test.setTimeout(120_000)

  test.beforeAll(async () => {
    const articles = await getArticlesPayload()
    const news = await getNewsPayload()

    const article = await articles.create({
      collection: 'articles',
      data: {
        title: articleTitle,
        slug: sharedSlug,
        summary: `Route isolation summary ${sharedSlug}`,
        authorName: 'Demo Agronomist',
        publishedAt: new Date().toISOString(),
        tags: [{ tag: 'route-isolation' }],
        content: [
          {
            blockType: 'section',
            heading: 'Route isolation section',
            level: 'h2',
            body: articleRichText(articleBody),
          },
        ],
        _status: 'published',
      },
    })
    articleID = article.id

    const item = await news.create({
      collection: 'news',
      data: {
        title: newsTitle,
        slug: sharedSlug,
        listingDescription: `Route isolation listing ${sharedSlug}`,
        body: newsBody(newsBodyText),
        publishedAt: new Date().toISOString(),
        _status: 'published',
      },
    })
    newsID = item.id
  })

  test.afterAll(async () => {
    if (articleID !== undefined) {
      const articles = await getArticlesPayload()
      await articles.delete({ collection: 'articles', id: articleID }).catch(() => undefined)
    }

    if (newsID !== undefined) {
      const news = await getNewsPayload()
      await news.delete({ collection: 'news', id: newsID }).catch(() => undefined)
    }
  })

  test('resolves the same slug to the right collection on each section', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const articleResponse = await page.goto(`${baseURL}/articles/${sharedSlug}`)
    expect(articleResponse?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText(articleTitle)
    await expect(page.locator('article')).toContainText(articleBody)
    await expect(page.getByText(newsBodyText)).toHaveCount(0)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${baseURL}/articles/${sharedSlug}`,
    )
    expect(await page.content()).not.toContain(newsTitle)

    const newsResponse = await page.goto(`${baseURL}/news/${sharedSlug}`)
    expect(newsResponse?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText(newsTitle)
    await expect(page.locator('article')).toContainText(newsBodyText)
    await expect(page.getByText(articleBody)).toHaveCount(0)
    expect(await page.content()).not.toContain(articleTitle)

    await context.close()
  })

  test('keeps each list scoped to its own collection', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const articleList = await page.goto(`${baseURL}/articles`)
    expect(articleList?.status()).toBe(200)
    await expect(page.getByText(articleTitle).first()).toBeVisible()
    await expect(page.getByText(newsTitle)).toHaveCount(0)
    await expect(page.getByText(newsBodyText)).toHaveCount(0)

    const newsList = await page.goto(`${baseURL}/news`)
    expect(newsList?.status()).toBe(200)
    await expect(page.getByText(newsTitle).first()).toBeVisible()
    await expect(page.getByText(articleTitle)).toHaveCount(0)
    await expect(page.getByText(articleBody)).toHaveCount(0)

    await context.close()
  })
})
