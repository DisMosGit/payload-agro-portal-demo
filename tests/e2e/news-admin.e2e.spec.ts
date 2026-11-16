import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { getNewsPayload } from '../helpers/seedNews'

const baseURL = 'http://localhost:3000'

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `news-admin-${unique}@example.com`
const adminPassword = 'test'
const firstTitle = `Admin published ${unique}`
const editedTitle = `Admin edited ${unique}`

let adminUserId: number | string | undefined
let newsId: number | string | undefined

async function publish(page: Page): Promise<void> {
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/news') && ['POST', 'PATCH'].includes(res.request().method()),
    { timeout: 60_000 },
  )

  await page.locator('#action-save').click()
  const response = await responsePromise
  const status = response.status()

  if (status >= 400) {
    throw new Error(`Publish failed with ${status}: ${await response.text()}`)
  }
}

async function unpublish(page: Page): Promise<void> {
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/news') && res.request().method() === 'PATCH',
    { timeout: 60_000 },
  )

  await page.locator('.doc-controls__dots').click()
  await page.locator('#action-unpublish').click()
  await page.locator('#confirm-action').click()
  const response = await responsePromise
  const status = response.status()

  if (status >= 400) {
    throw new Error(`Unpublish failed with ${status}: ${await response.text()}`)
  }
}

test.describe('News admin publishing', () => {
  test.setTimeout(240_000)

  test.beforeAll(async () => {
    const payload = await getNewsPayload()
    const user = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: adminPassword },
    })

    adminUserId = user.id
  })

  test.afterAll(async () => {
    const payload = await getNewsPayload()

    if (newsId !== undefined) {
      await payload.delete({ collection: 'news', id: newsId }).catch(() => undefined)
    }

    if (adminUserId !== undefined) {
      await payload.delete({ collection: 'users', id: adminUserId }).catch(() => undefined)
    }
  })

  test('creates, publishes, edits, and unpublishes an item through the admin UI', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await login({ page, user: { email: adminEmail, password: adminPassword } })

    await page.goto(`${baseURL}/admin/collections/news/create`)
    await page.locator('#field-title').fill(firstTitle)
    await page.locator('#field-listingDescription').fill(`Listing text for ${unique}`)
    await page.locator('[data-lexical-editor="true"]').click()
    await page.keyboard.type(`Body written in the admin for ${unique}.`)

    await publish(page)

    await page.waitForURL(/\/admin\/collections\/news\/\d+/)
    const idMatch = page.url().match(/\/admin\/collections\/news\/(\d+)/)
    newsId = idMatch?.[1]
    expect(newsId).toBeDefined()

    const slugField = page.locator('#field-slug')
    await expect(slugField).toHaveValue(/.+/)
    const publishedSlug = (await slugField.inputValue()).trim()
    expect(publishedSlug).not.toBe('')

    // A fresh anonymous visitor sees the publish on the next request.
    const anon = await browser.newContext()
    const anonPage = await anon.newPage()

    const listResponse = await anonPage.goto(`${baseURL}/news`)
    expect(listResponse?.status()).toBe(200)
    const adminCard = anonPage
      .locator('article')
      .filter({ has: anonPage.locator(`a[href="/news/${publishedSlug}"]`) })
    await expect(adminCard).toContainText(firstTitle)

    const detailResponse = await anonPage.goto(`${baseURL}/news/${publishedSlug}`)
    expect(detailResponse?.status()).toBe(200)
    await expect(anonPage.locator('h1')).toHaveText(firstTitle)
    await expect(anonPage.locator('article')).toContainText(
      `Body written in the admin for ${unique}.`,
    )

    // Editing the title is visible on the next public request.
    await page.locator('#field-title').fill(editedTitle)
    await publish(page)

    await expect(page.locator('#field-slug')).toHaveValue(publishedSlug)
    const editedSlug = (await page.locator('#field-slug').inputValue()).trim()
    expect(editedSlug).toBe(publishedSlug)

    const editedList = await anonPage.goto(`${baseURL}/news`)
    expect(editedList?.status()).toBe(200)
    await expect(adminCard).toContainText(editedTitle)

    const editedDetail = await anonPage.goto(`${baseURL}/news/${editedSlug}`)
    expect(editedDetail?.status()).toBe(200)
    await expect(anonPage.locator('h1')).toHaveText(editedTitle)

    // Unpublishing removes it from the public site.
    await unpublish(page)

    const hiddenList = await anonPage.goto(`${baseURL}/news`)
    expect(hiddenList?.status()).toBe(200)
    await expect(anonPage.getByText(editedTitle, { exact: false })).toHaveCount(0)

    const hiddenDetail = await anonPage.goto(`${baseURL}/news/${editedSlug}`)
    expect(hiddenDetail?.status()).toBe(404)

    await anon.close()
    await context.close()
  })
})
