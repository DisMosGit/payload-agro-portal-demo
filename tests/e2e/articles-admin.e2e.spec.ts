import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { articleRichText, getArticlesPayload, uniqueArticleSlug } from '../helpers/seedArticles'

const baseURL = 'http://localhost:3000'
const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `articles-admin-e2e-${unique}@example.com`
const adminPassword = 'test'
const firstTitle = `Admin article ${unique}`
const editedTitle = `Admin edited article ${unique}`
const bodyText = `Article body written in the admin for ${unique}.`

let adminUserID: number | string | undefined
let articleID: number | string | undefined
let scheduledID: number | string | undefined
let publishedSlug = ''
let scheduledSlug = ''

async function publish(page: Page): Promise<{ id: number | string; slug: string }> {
  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().includes('/api/articles') && ['POST', 'PATCH'].includes(res.request().method()),
    { timeout: 60_000 },
  )

  await page.locator('#action-save').click()
  const response = await responsePromise
  const status = response.status()

  if (status >= 400) {
    throw new Error(`Publish failed with ${status}: ${await response.text()}`)
  }

  const body = await response.json()
  return { id: body.doc.id, slug: body.doc.slug }
}

async function unpublish(page: Page): Promise<void> {
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/api/articles') && res.request().method() === 'PATCH',
    { timeout: 60_000 },
  )

  await page.locator('.doc-controls__dots').click()
  await page.locator('#action-unpublish').click()
  await page.locator('#confirm-action').click()
  const response = await responsePromise

  if (response.status() >= 400) {
    throw new Error(`Unpublish failed with ${response.status()}: ${await response.text()}`)
  }
}

test.describe('Articles admin publishing', () => {
  test.setTimeout(240_000)

  test.beforeAll(async () => {
    const payload = await getArticlesPayload()
    const user = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: adminPassword },
    })
    adminUserID = user.id

    scheduledSlug = uniqueArticleSlug('admin-scheduled-article')
    const scheduled = await payload.create({
      collection: 'articles',
      data: {
        title: `Admin scheduled article ${scheduledSlug}`,
        slug: scheduledSlug,
        summary: `Scheduled summary ${scheduledSlug}`,
        authorName: 'Demo Agronomist',
        publishedAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        content: [
          {
            blockType: 'section',
            heading: 'Scheduled admin section',
            level: 'h2',
            body: articleRichText(`Scheduled body ${scheduledSlug}`),
          },
        ],
      },
      draft: true,
    })
    scheduledID = scheduled.id
  })

  test.afterAll(async () => {
    const payload = await getArticlesPayload()

    for (const id of [articleID, scheduledID]) {
      if (id !== undefined) {
        await payload.delete({ collection: 'articles', id }).catch(() => undefined)
      }
    }

    if (adminUserID !== undefined) {
      await payload.delete({ collection: 'users', id: adminUserID }).catch(() => undefined)
    }
  })

  test('creates, publishes, edits, and unpublishes through the admin UI', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await login({ page, user: { email: adminEmail, password: adminPassword } })

    await page.goto(`${baseURL}/admin/collections/articles/create`)
    await page.locator('#field-title').fill(firstTitle)
    await page.locator('#field-authorName').fill('Admin Author')

    // Regression: group children evaluate conditions against their sibling data,
    // so enabling the group must reveal the conditional fields. The form hydrates
    // after paint, so re-toggle until React records the change instead of sleeping.
    await expect(async () => {
      const toggle = page.locator('#field-video__enabled')
      if (!(await toggle.isChecked())) {
        await toggle.check()
      }
      await expect(page.locator('#field-video__youtubeUrl')).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
    await page.locator('#field-video__enabled').uncheck()
    await expect(page.locator('#field-video__youtubeUrl')).toHaveCount(0)

    await page.getByRole('button', { name: 'Add Content' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Section', exact: true }).click()

    // The first block render pulls a lazily compiled editor chunk from the dev
    // server, which can take well over 30 seconds on a cold start.
    await expect(page.locator('#field-content__0__heading')).toBeVisible({ timeout: 120_000 })
    await page.locator('#field-content__0__heading').fill('Admin section')
    const editor = page.locator('#content-row-0 [data-lexical-editor="true"]').first()
    await editor.click()
    await page.keyboard.type(bodyText)

    const created = await publish(page)
    articleID = created.id
    publishedSlug = created.slug
    expect(publishedSlug).not.toBe('')

    await page.waitForURL(new RegExp(`/admin/collections/articles/${created.id}`))
    await expect(page.locator('#field-slug')).toHaveValue(publishedSlug)

    // A fresh anonymous visitor sees the publish on the next request.
    const anon = await browser.newContext()
    const anonPage = await anon.newPage()

    const listResponse = await anonPage.goto(`${baseURL}/articles`)
    expect(listResponse?.status()).toBe(200)
    const adminCard = anonPage
      .locator('article')
      .filter({ has: anonPage.locator(`a[href="/articles/${publishedSlug}"]`) })
    await expect(adminCard).toContainText(firstTitle)

    const detailResponse = await anonPage.goto(`${baseURL}/articles/${publishedSlug}`)
    expect(detailResponse?.status()).toBe(200)
    await expect(anonPage.locator('h1')).toHaveText(firstTitle)
    await expect(anonPage.locator('article')).toContainText(bodyText)

    // Editing the title is visible on the next public request and keeps the slug.
    await page.locator('#field-title').fill(editedTitle)
    await publish(page)

    await expect(page.locator('#field-slug')).toHaveValue(publishedSlug)
    const editedSlug = (await page.locator('#field-slug').inputValue()).trim()
    expect(editedSlug).toBe(publishedSlug)

    const editedList = await anonPage.goto(`${baseURL}/articles`)
    expect(editedList?.status()).toBe(200)
    await expect(adminCard).toContainText(editedTitle)

    const editedDetail = await anonPage.goto(`${baseURL}/articles/${publishedSlug}`)
    expect(editedDetail?.status()).toBe(200)
    await expect(anonPage.locator('h1')).toHaveText(editedTitle)

    // The scheduled article is absent before its time even in the admin list.
    const scheduledList = await anonPage.goto(`${baseURL}/articles`)
    expect(scheduledList?.status()).toBe(200)
    await expect(anonPage.getByText(`Admin scheduled article ${scheduledSlug}`)).toHaveCount(0)
    const scheduledDetail = await anonPage.goto(`${baseURL}/articles/${scheduledSlug}`)
    expect(scheduledDetail?.status()).toBe(404)

    // Unpublishing removes the article from the public site.
    await unpublish(page)

    const hiddenList = await anonPage.goto(`${baseURL}/articles`)
    expect(hiddenList?.status()).toBe(200)
    await expect(anonPage.getByText(editedTitle, { exact: false })).toHaveCount(0)

    const hiddenDetail = await anonPage.goto(`${baseURL}/articles/${publishedSlug}`)
    expect(hiddenDetail?.status()).toBe(404)

    await anon.close()
    await context.close()
  })
})
