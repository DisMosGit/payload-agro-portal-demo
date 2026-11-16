import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { getServicePointsPayload } from '../helpers/seedServicePoints'

const baseURL = 'http://localhost:3000'

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const adminEmail = `service-points-admin-${unique}@example.com`
const adminPassword = 'test'
const pointName = `Admin service point ${unique}`

let adminUserId: number | string | undefined
let pointId: number | string | undefined

test.describe('Service points admin', () => {
  test.setTimeout(180_000)

  test.beforeAll(async () => {
    const payload = await getServicePointsPayload()
    const user = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: adminPassword },
    })

    adminUserId = user.id
  })

  test.afterAll(async () => {
    const payload = await getServicePointsPayload()

    if (pointId !== undefined) {
      await payload.delete({ collection: 'service-points', id: pointId }).catch(() => undefined)
    }

    if (adminUserId !== undefined) {
      await payload.delete({ collection: 'users', id: adminUserId }).catch(() => undefined)
    }
  })

  test('creates a point in the admin panel and shows it after a public reload', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await login({ page, user: { email: adminEmail, password: adminPassword } })
    await page.goto(`${baseURL}/admin/collections/service-points/create`)

    await page.locator('#field-name').fill(pointName)
    await page.locator('#field-latitude').fill('52.2297')
    await page.locator('#field-longitude').fill('21.0122')
    await page.locator('#field-address').fill(`Admin Street 1, ${unique}`)
    await page.locator('#field-phone').fill('+48 999 888 777')

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/service-points') && res.request().method() === 'POST',
      { timeout: 60_000 },
    )

    await page.locator('#action-save').click()
    const response = await responsePromise
    const status = response.status()

    if (status >= 400) {
      throw new Error(`Create failed with ${status}: ${await response.text()}`)
    }

    await page.waitForURL(/\/admin\/collections\/service-points\/\d+/)
    const idMatch = page.url().match(/\/admin\/collections\/service-points\/(\d+)/)
    pointId = idMatch?.[1]
    expect(pointId).toBeDefined()

    // A fresh anonymous visitor sees the new point on the next request, and
    // again after a reload, so the value comes from storage rather than a
    // client-side cache.
    const anon = await browser.newContext()
    const anonPage = await anon.newPage()

    const firstLoad = await anonPage.goto(`${baseURL}/service-points`)
    expect(firstLoad?.status()).toBe(200)
    await expect(anonPage.getByText(pointName, { exact: false }).first()).toBeVisible()
    await expect(
      anonPage.getByRole('button', { name: `Show details for ${pointName}` }),
    ).toBeVisible()

    await anonPage.reload()
    await expect(anonPage.getByText(pointName, { exact: false }).first()).toBeVisible()
    await expect(
      anonPage.getByRole('button', { name: `Show details for ${pointName}` }),
    ).toBeVisible()

    await anon.close()
    await context.close()
  })
})
