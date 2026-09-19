import { expect, test } from '@playwright/test'
import { DEMO, signIn } from './helpers'

/**
 * The in-app viewer and live updates are the two features most likely to be
 * quietly broken by an unrelated change: one depends on a permission flag that
 * looks like dead config, the other on a long-lived connection that nothing
 * else in the suite exercises.
 */

test.describe('opening a provider inside the app', () => {
  test('frames the provider, and says whose site it is', async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)

    // Northbound Adventures is the seeded provider that has agreed to in-app
    // display. Any deal of theirs will do.
    await page.goto('/search?q=Costa%20Rica')
    await page.waitForLoadState('networkidle')
    await page.locator('article h3 a').first().click()
    await page.waitForURL(/\/deals\//)

    await page.getByRole('button', { name: /^View on / }).click()

    const viewer = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(viewer).toBeVisible()

    // A framed page that did not say whose it was would turn "we are only a
    // search service" from a true statement into a misleading one.
    await expect(viewer.getByText(/Any booking is made with them, not with Voyaj/i)).toBeVisible()
    await expect(viewer.getByText('Northbound Adventures').first()).toBeVisible()
    await expect(viewer.getByRole('button', { name: /open in browser/i })).toBeVisible()
  })

  test('asks what happened on the way out, and takes no for an answer', async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)
    await page.goto('/search?q=Costa%20Rica')
    await page.waitForLoadState('networkidle')
    await page.locator('article h3 a').first().click()
    await page.waitForURL(/\/deals\//)
    await page.getByRole('button', { name: /^View on / }).click()

    const viewer = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(viewer).toBeVisible()
    await viewer.getByRole('button', { name: /close and return to voyaj/i }).click()

    await expect(page.getByText(/did you book with/i)).toBeVisible()
    // Skipping must be possible. A booking is never inferred from a click.
    await page.getByRole('button', { name: /^skip$/i }).click()
    await expect(viewer).toBeHidden()
  })
})

test.describe('live updates', () => {
  test('the stream opens and reports itself live only once connected', async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)
    await page.goto('/discover')
    await page.locator('article h3 a').first().click()
    await page.waitForURL(/\/deals\//)

    await expect(page.getByText(/updating live as providers post/i)).toBeVisible({
      timeout: 15_000,
    })
  })

  test('a change published by the server reaches an open page', async ({ page, browser }) => {
    await signIn(page, DEMO.email, DEMO.password)
    await page.goto('/discover')
    await page.locator('article h3 a').first().click()
    await page.waitForURL(/\/deals\//)
    const dealId = page.url().split('/deals/')[1].split('?')[0]

    // Start listening as the member would.
    const received = page.evaluate(
      (id) =>
        new Promise<unknown>((resolve) => {
          const source = new EventSource(`/api/live/deals?deals=${id}`)
          source.addEventListener('deal-change', (event) => {
            source.close()
            resolve(JSON.parse((event as MessageEvent).data))
          })
          setTimeout(() => {
            source.close()
            resolve(null)
          }, 20_000)
        }),
      dealId,
    )

    // An admin changes availability in a different session entirely. It needs
    // its own browser context: a second page in the member's context would
    // already carry the member's cookie and never see the login form.
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    await signIn(adminPage, 'admin@voyaj.test', 'VoyajAdmin!2025')
    await adminPage.evaluate(async (id) => {
      await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dealId: id, status: 'SOLD_OUT' }),
      })
    }, dealId)

    const change = (await received) as { dealId: string; kind: string; status: string } | null
    expect(change, 'No live update arrived within 20s').not.toBeNull()
    expect(change!.dealId).toBe(dealId)
    expect(change!.status).toBe('SOLD_OUT')

    // Leave the marketplace as we found it.
    await adminPage.evaluate(async (id) => {
      await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dealId: id, status: 'ACTIVE' }),
      })
    }, dealId)
    await adminContext.close()
  })

  test('the stream requires a signed-in member', async ({ request }) => {
    const response = await request.get('/api/live/deals?deals=whatever')
    expect(response.status()).toBe(401)
  })
})

test.describe('the search-service position is stated where money is spent', () => {
  test('the deal page says we are not the seller', async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)
    await page.goto('/discover')
    await page.locator('article h3 a').first().click()
    await page.waitForURL(/\/deals\//)

    await expect(page.getByText(/Voyaj is a search service, not the seller/i)).toBeVisible()
    await expect(page.getByText(/not a party to your booking/i)).toBeVisible()
  })
})
