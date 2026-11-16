import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

import { login } from '../helpers/login'
import { getArticlesPayload } from '../helpers/seedArticles'

const baseURL = 'http://localhost:3000'
const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `manual-check-${unique}@example.com`
const title = `Resilient video article ${unique}`
const duration = '4:20'
const externalUrl = 'https://example.com/watch/resilient-video'
const alternativeUrl = 'https://example.com/media/resilient-video.mp4'

async function uploadMedia(
  request: APIRequestContext,
  token: string,
  alt: string,
  filename: string,
  width: number,
  height: number,
): Promise<void> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 24, g: 122, b: 92 } },
  })
    .png()
    .toBuffer()

  // Upload through the running app so the file lands in the app's media volume.
  const response = await request.post(`${baseURL}/api/media`, {
    headers: { Authorization: `JWT ${token}` },
    multipart: {
      _payload: JSON.stringify({ alt }),
      file: { name: filename, mimeType: 'image/png', buffer },
    },
  })
  expect(response.status()).toBeLessThan(400)
}

const shotDir = path.join(process.cwd(), 'test-results', 'articles-video-admin')

async function chooseExisting(page: Page, fieldId: string, filename: string): Promise<void> {
  await page.locator(`${fieldId} .upload__listToggler`).click()
  const row = page.locator('.drawer__content tbody tr').filter({ hasText: filename }).first()
  await expect(row).toBeVisible({ timeout: 60_000 })
  await row.locator('button.default-cell__first-cell').click()
  // An upload relationship renders an SVG thumbnail, not an <img>, so wait for
  // the filename link that only appears once the drawer selection is applied.
  await expect(page.locator(`${fieldId} a`).filter({ hasText: filename })).toBeVisible({
    timeout: 60_000,
  })
}

test('creates a video article in the admin and degrades when YouTube is blocked', async ({
  browser,
  request,
}) => {
  test.setTimeout(240_000)
  fs.mkdirSync(shotDir, { recursive: true })

  const payload = await getArticlesPayload()
  const user = await payload.create({ collection: 'users', data: { email, password: 'test' } })

  const tokenResponse = await request.post(`${baseURL}/api/users/login`, {
    data: { email, password: 'test' },
  })
  expect(tokenResponse.status()).toBe(200)
  const { token } = (await tokenResponse.json()) as { token: string }

  const posterFilename = `poster-${unique}.png`
  await uploadMedia(request, token, `Manual poster ${unique}`, posterFilename, 1280, 720)
  const inlineFilename = `inline-${unique}.png`
  await uploadMedia(request, token, `Manual inline image ${unique}`, inlineFilename, 800, 600)

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await login({ page, user: { email, password: 'test' } })

  await page.goto(`${baseURL}/admin/collections/articles/create`)
  await page.locator('#field-title').fill(title)
  await page.locator('#field-authorName').fill('Manual Agronomist')
  await page.locator('#field-summary').fill('Manual verification of the resilient video article.')

  await page.locator('#field-video__enabled').check()
  await expect(page.locator('#field-video__youtubeUrl')).toBeVisible({ timeout: 60_000 })
  await page.locator('#field-video__youtubeUrl').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.locator('#field-video__title').fill('Manual video check')
  await page.locator('#field-video__duration').fill(duration)
  await page.locator('#field-video__externalUrl').fill(externalUrl)
  await page.locator('#field-video__alternativeSourceUrl').fill(alternativeUrl)
  await chooseExisting(page, '#field-video__poster', posterFilename)

  await page.getByRole('button', { name: 'Add Content' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Section', exact: true }).click()
  await expect(page.locator('#field-content__0__heading')).toBeVisible({ timeout: 120_000 })
  await page.locator('#field-content__0__heading').fill('Manual field section')
  await page.locator('#content-row-0 [data-lexical-editor="true"]').first().click()
  await page.keyboard.type('Long-form body written in the admin during manual verification.')

  await page.getByRole('button', { name: 'Add Content' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Callout', exact: true }).click()
  await expect(page.locator('#field-content__1__title')).toBeVisible({ timeout: 120_000 })
  await page.locator('#field-content__1__title').fill('Manual callout')
  await page.locator('#content-row-1 [data-lexical-editor="true"]').first().click()
  await page.keyboard.type('Callout body written in the admin.')

  await page.getByRole('button', { name: 'Add Content' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Image', exact: true }).click()
  await expect(page.locator('#field-content__2__image .upload__listToggler')).toBeVisible({
    timeout: 120_000,
  })
  await chooseExisting(page, '#field-content__2__image', inlineFilename)
  await page.locator('#field-content__2__caption').fill('Manual inline image')

  const saveResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/articles') && ['POST', 'PATCH'].includes(res.request().method()),
    { timeout: 120_000 },
  )
  await page.locator('#action-save').click()
  const saved = await saveResponse
  expect(saved.status()).toBeLessThan(400)
  const doc = await saved.json()
  const slug = doc.doc.slug as string
  expect(slug).not.toBe('')

  await context.close()

  // Public list and detail, as an anonymous visitor.
  const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const anonPage = await anon.newPage()
  await anonPage.goto(`${baseURL}/articles`)
  await anonPage.screenshot({ path: path.join(shotDir, 'articles-list.png'), fullPage: true })

  const card = anonPage
    .locator('article')
    .filter({ has: anonPage.locator(`a[href="/articles/${slug}"]`) })
  await expect(card).toContainText(title)
  await expect(card).toContainText(duration)

  const detail = await anonPage.goto(`${baseURL}/articles/${slug}`)
  expect(detail?.status()).toBe(200)
  await expect(anonPage.locator('h1')).toHaveText(title)
  await expect(anonPage.locator('nav[aria-label="Table of contents"]')).toBeVisible()
  await expect(anonPage.getByText('Long-form body written in the admin')).toBeVisible()
  await expect(anonPage.getByText('Manual callout')).toBeVisible()
  await expect(anonPage.getByAltText('Manual inline image')).toBeVisible()
  await expect(anonPage.locator('[data-video-facade]')).toBeVisible()
  await expect(anonPage.getByLabel(`Video duration ${duration}`)).toBeVisible()
  await expect(anonPage.getByRole('link', { name: 'Watch externally' })).toHaveAttribute(
    'href',
    externalUrl,
  )
  await expect(
    anonPage.getByRole('link', { name: 'Open alternative video source' }),
  ).toHaveAttribute('href', alternativeUrl)

  const youtubeRequests: string[] = []
  anonPage.on('request', (request) => {
    if (request.url().includes('youtube')) {
      youtubeRequests.push(request.url())
    }
  })
  await anonPage.screenshot({ path: path.join(shotDir, 'article-detail.png'), fullPage: true })
  expect(youtubeRequests).toEqual([])

  // Block YouTube the way a filtered region would: the request hangs, then fails.
  await anonPage.route(/youtube/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 9000))
    await route.abort('failed').catch(() => undefined)
  })

  await anonPage.locator('[data-video-facade][data-hydrated="true"]').waitFor({ timeout: 60_000 })
  await anonPage.getByRole('link', { name: /^Play video/ }).click()

  await expect(anonPage.locator('section[aria-label="Video"] [role="alert"]')).toBeVisible({
    timeout: 20_000,
  })
  await expect(anonPage.getByRole('link', { name: 'Watch externally' })).toBeVisible()
  await expect(anonPage.getByRole('link', { name: 'Open alternative video source' })).toBeVisible()
  await expect(anonPage.getByLabel(`Video duration ${duration}`)).toBeVisible()
  await anonPage.screenshot({
    path: path.join(shotDir, 'article-video-blocked.png'),
    fullPage: true,
  })

  await anon.close()

  const media = await request.get(`${baseURL}/api/media?limit=100&depth=0`, {
    headers: { Authorization: `JWT ${token}` },
  })
  const { docs } = (await media.json()) as { docs: Array<{ filename?: string; id: number }> }
  for (const file of docs) {
    if (file.filename === posterFilename || file.filename === inlineFilename) {
      await request.delete(`${baseURL}/api/media/${file.id}`, {
        headers: { Authorization: `JWT ${token}` },
      })
    }
  }

  const cleanup = await getArticlesPayload()
  await cleanup.delete({ collection: 'articles', id: doc.doc.id }).catch(() => undefined)
  await cleanup.delete({ collection: 'users', id: user.id }).catch(() => undefined)
})
