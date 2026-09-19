import { expect, test } from '@playwright/test'
import { DEMO, signIn } from './helpers'

/**
 * The security headers are only worth having if the product still works with
 * them on. A Content Security Policy that blocks the application's own scripts
 * gets removed by the next person who is in a hurry, so it needs to be held in
 * place by a test rather than by good intentions.
 */

const PUBLIC_PAGES = ['/', '/pricing', '/faq', '/login', '/signup', '/legal/privacy']
const MEMBER_PAGES = ['/discover', '/search', '/people', '/profile', '/settings/travel']

test.describe('security headers', () => {
  test('every response carries the policy, and it is not weakened', async ({ request }) => {
    const response = await request.get('/')
    const headers = response.headers()

    const csp = headers['content-security-policy']
    expect(csp, 'No Content-Security-Policy header').toBeTruthy()

    // The nonce is what makes script-src worth anything.
    expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/)
    // These two would each render the policy decorative.
    expect(csp, "script-src must not allow 'unsafe-inline'").not.toMatch(
      /script-src [^;]*'unsafe-inline'/,
    )
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")

    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('a fresh nonce is issued per request', async ({ request }) => {
    const nonceOf = async () => {
      const csp = (await request.get('/')).headers()['content-security-policy']
      return /'nonce-([^']+)'/.exec(csp)?.[1]
    }
    const [first, second] = [await nonceOf(), await nonceOf()]
    expect(first).toBeTruthy()
    // A reused nonce is no better than 'unsafe-inline'.
    expect(first).not.toBe(second)
  })

  test('API responses are never cached', async ({ request }) => {
    const response = await request.get('/api/social/share-targets')
    expect(response.headers()['cache-control']).toContain('no-store')
  })
})

test.describe('the policy does not break the product', () => {
  test('public pages load without a CSP violation', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (message) => {
      const text = message.text()
      if (/Content Security Policy|Refused to (load|execute|apply)/i.test(text)) {
        violations.push(text)
      }
    })

    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }

    expect(violations, `CSP violations:\n${violations.join('\n')}`).toEqual([])
  })

  test('member pages load without a CSP violation', async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)

    const violations: string[] = []
    page.on('console', (message) => {
      const text = message.text()
      if (/Content Security Policy|Refused to (load|execute|apply)/i.test(text)) {
        violations.push(text)
      }
    })

    for (const path of MEMBER_PAGES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }

    expect(violations, `CSP violations:\n${violations.join('\n')}`).toEqual([])
  })

  test('the app is interactive, so its scripts really did run', async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)
    await page.goto('/search')

    // A hydration failure under CSP looks like a page that renders but does
    // nothing, which a "page loaded" assertion would happily pass.
    await page.getByLabel('Search trips').fill('beach')
    await page.getByLabel('Search trips').press('Enter')
    await page.waitForURL(/q=beach/)
    await expect(page.locator('article').first()).toBeVisible()
  })
})

/**
 * The single most important honesty guarantee in the product: demonstration
 * inventory must never be mistakable for a real, bookable offer. It is the one
 * claim an investor demo, a new developer and a member all rely on, and it is
 * exactly the sort of label that gets dropped during a redesign.
 */
test.describe('demonstration content is always labelled', () => {
  test('every card in every list carries the label', async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)

    for (const path of ['/discover', '/search', '/saved']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const cards = page.locator('main article')
      const count = await cards.count()
      if (count === 0) continue

      // The seed creates demonstration inventory only, so every card shown
      // here must say so. If real inventory is ever added this assertion is
      // the thing that has to be made conditional — deliberately, not by
      // accident.
      const labelled = await page.getByText('Demo listing').count()
      expect(labelled, `${path}: ${count} cards but only ${labelled} labelled`).toBe(count)
    }
  })

  test('the deal page says plainly that it cannot be booked', async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)
    await page.goto('/discover')
    await page.locator('article h3 a').first().click()
    await page.waitForURL(/\/deals\//)

    await expect(page.getByText('This is demonstration content')).toBeVisible()
    await expect(page.getByText(/not a real offer and cannot be booked/i)).toBeVisible()
  })
})
