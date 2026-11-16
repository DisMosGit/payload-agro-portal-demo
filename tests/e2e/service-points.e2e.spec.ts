import { devices, expect, test } from '@playwright/test'

import {
  cleanupServicePoints,
  deleteAllServicePoints,
  getServicePointsPayload,
  restoreServicePoints,
  seedServicePoints,
  snapshotServicePoints,
  type SeededServicePoints,
  type ServicePointInput,
} from '../helpers/seedServicePoints'

const baseURL = 'http://localhost:3000'

let seeded: SeededServicePoints
let snapshot: ServicePointInput[] | null = null

async function countAllServicePoints(): Promise<number> {
  const payload = await getServicePointsPayload()
  const { docs } = await payload.find({
    collection: 'service-points',
    pagination: false,
    depth: 0,
  })

  return docs.length
}

test.describe('Public service points map', () => {
  test.beforeAll(async () => {
    seeded = await seedServicePoints()
  })

  test.afterAll(async () => {
    // The empty-state test removes every point; restore the pre-test set before
    // deleting only this run's fixtures.
    if (snapshot) {
      await restoreServicePoints(snapshot)
    }

    await cleanupServicePoints(seeded)
  })

  test('renders one marker per point and the server-rendered list', async ({ page }) => {
    const response = await page.goto(`${baseURL}/service-points`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { level: 1, name: 'Service points' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Service points map' })).toBeVisible()
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible()

    const expectedCount = await countAllServicePoints()
    await expect(page.getByRole('button', { name: /^Show details for / })).toHaveCount(
      expectedCount,
    )

    for (const point of seeded.points) {
      await expect(
        page.getByRole('button', { name: `Show details for ${point.name}` }),
      ).toBeVisible()

      const card = page.locator('article').filter({ hasText: point.name })
      await expect(card).toHaveCount(1)
      await expect(card).toContainText(point.address ?? '')
      await expect(card).toContainText(point.phone ?? '')
      await expect(card).toContainText(point.email ?? '')
    }

    const html = await page.content()
    expect(html).not.toContain('<form')
    expect(html).not.toContain('href="/admin"')
    expect(html).not.toMatch(/>\s*(Edit|Delete)\s*</)

    const hasNoHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    )
    expect(hasNoHorizontalOverflow).toBe(true)
  })

  test('opens a read-only popup with the point details', async ({ page }) => {
    const target = seeded.points[0]
    await page.goto(`${baseURL}/service-points`)

    await page.getByRole('button', { name: `Show details for ${target.name}` }).click()

    const popup = page.locator('.maplibregl-popup').filter({ hasText: target.name })
    await expect(popup).toBeVisible()
    await expect(popup).toContainText(target.name)
    await expect(popup).toContainText(target.address ?? '')
    await expect(popup).toContainText(target.phone ?? '')
    await expect(popup).toContainText(target.email ?? '')

    await expect(popup.locator('input, form, textarea, select')).toHaveCount(0)
    await expect(popup).not.toContainText('Save')
    await expect(popup).not.toContainText('Edit')
    await expect(popup).not.toContainText('Delete')
  })

  test('keeps every point in the HTML without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const response = await page.goto(`${baseURL}/service-points`)
    expect(response?.status()).toBe(200)

    for (const point of seeded.points) {
      await expect(page.getByText(point.name, { exact: false })).toHaveCount(1)
      await expect(page.getByText(point.address ?? '', { exact: false })).toHaveCount(1)
    }

    const html = await page.content()
    expect(html).not.toContain('<form')
    expect(html).not.toContain('href="/admin"')

    await context.close()
  })

  test('works at a mobile viewport', async ({ browser }) => {
    const target = seeded.points[0]
    const context = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await context.newPage()

    const response = await page.goto(`${baseURL}/service-points`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('region', { name: 'Service points map' })).toBeVisible()
    const marker = page.getByRole('button', { name: `Show details for ${target.name}` })
    await expect(marker).toBeVisible()

    await marker.tap()

    const popup = page.locator('.maplibregl-popup').filter({ hasText: target.name })
    await expect(popup).toBeVisible()
    await expect(popup).toContainText(target.address ?? '')

    const popupBox = await popup.boundingBox()
    expect(popupBox).not.toBeNull()
    expect(popupBox!.x).toBeGreaterThanOrEqual(0)
    expect(popupBox!.x + popupBox!.width).toBeLessThanOrEqual(390 + 1)

    const hasNoHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    )
    expect(hasNoHorizontalOverflow).toBe(true)

    await context.close()
  })

  // Keep this last: it removes every point and restores the snapshot in
  // afterAll. Running it earlier would hide the other tests' fixtures.
  test('shows the empty state and no map when there are no points', async ({ page }) => {
    snapshot = await snapshotServicePoints()
    await deleteAllServicePoints()

    const response = await page.goto(`${baseURL}/service-points`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { level: 1, name: 'Service points' })).toBeVisible()
    await expect(page.getByText('No service points have been added yet.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Service points map' })).toHaveCount(0)
    await expect(page.locator('canvas')).toHaveCount(0)
  })
})
