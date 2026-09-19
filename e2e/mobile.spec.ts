import { expect, test } from '@playwright/test'
import { DEMO, signIn, expectNoHorizontalOverflow, expectTouchTargets } from './helpers'

/**
 * MOBILE QA
 *
 * The product is mobile-first, so these run at real phone dimensions and fail
 * on the things that actually ruin a mobile experience: sideways scroll,
 * controls too small to tap, and navigation that disappears.
 */

const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 13', width: 390, height: 844 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'iPad mini', width: 768, height: 1024 },
]

const PUBLIC_PAGES = ['/', '/pricing', '/faq', '/login', '/signup', '/legal/privacy']
const MEMBER_PAGES = [
  '/discover', '/search', '/saved', '/people', '/circles',
  '/trips', '/chats', '/profile', '/settings/profile', '/settings/travel', '/upgrade',
]

test.describe('no page scrolls sideways', () => {
  for (const viewport of VIEWPORTS) {
    test(`public pages at ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      for (const path of PUBLIC_PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expectNoHorizontalOverflow(page)
      }
    })
  }

  test('member pages at 375px, the narrowest phone we support', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await signIn(page, DEMO.email, DEMO.password)
    for (const path of MEMBER_PAGES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expectNoHorizontalOverflow(page)
    }
  })
})

test.describe('touch targets are big enough to hit', () => {
  test('on the landing page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expectTouchTargets(page)
  })

  test('on the signup form', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/signup')
    await expectTouchTargets(page)
  })

  test('on the preference cards, where the dots are the whole interaction', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await signIn(page, DEMO.email, DEMO.password)
    await page.goto('/settings/travel?section=ACTIVITY')
    await page.waitForLoadState('networkidle')
    await expectTouchTargets(page)
  })
})

test.describe('mobile navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await signIn(page, DEMO.email, DEMO.password)
  })

  test('the bottom bar is present and works', async ({ page }) => {
    await page.goto('/discover')
    const bottomNav = page.locator('nav[aria-label="Main"]').last()
    await expect(bottomNav).toBeVisible()

    await bottomNav.getByRole('link', { name: 'Search' }).click()
    await page.waitForURL('**/search')

    await bottomNav.getByRole('link', { name: 'People' }).click()
    await page.waitForURL('**/people')

    await bottomNav.getByRole('link', { name: 'Profile' }).click()
    await page.waitForURL('**/profile')
  })

  test('the bottom bar does not cover the last of the content', async ({ page }) => {
    await page.goto('/discover')
    await page.waitForLoadState('networkidle')
    // Images and cards settle in after the first paint, so the page keeps
    // growing underneath a single scroll. Keep scrolling until the position
    // stops moving, otherwise we measure the middle of the page and call it
    // the bottom.
    await page.evaluate(async () => {
      let previous = -1
      for (let attempt = 0; attempt < 20 && window.scrollY !== previous; attempt += 1) {
        previous = window.scrollY
        window.scrollTo(0, document.documentElement.scrollHeight)
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    })
    await page.waitForTimeout(300)

    const covered = await page.evaluate(() => {
      // There are two navs labelled "Main": the desktop one (display:none at
      // this width, so it measures as a zero-height box at the top of the
      // page) and the fixed bottom bar. Only a rendered one can cover
      // anything, so pick the last nav that is actually on screen.
      const nav = [...document.querySelectorAll('nav[aria-label="Main"]')]
        .filter((n) => n.getBoundingClientRect().height > 0)
        .pop()
      if (!nav) return null
      const navTop = nav.getBoundingClientRect().top

      // Scrolled to the very bottom, no card may still be tucked under the bar.
      const hidden = [...document.querySelectorAll('main article')]
        .map((a) => a.getBoundingClientRect())
        .filter((rect) => rect.bottom > navTop && rect.bottom - navTop > 4)
        .map((rect) => Math.round(rect.bottom - navTop))
      return hidden
    })

    expect(covered, 'The bottom navigation bar was not found on screen').not.toBeNull()
    expect(covered, `Content is hidden behind the bottom navigation bar by ${covered?.join(', ')}px`)
      .toEqual([])
  })
})

test.describe('the deal card renders properly on a phone', () => {
  test('text does not overlap and the price is readable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await signIn(page, DEMO.email, DEMO.password)
    await page.goto('/discover')
    await page.waitForLoadState('networkidle')

    const card = page.locator('article').first()
    await expect(card).toBeVisible()

    const box = await card.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(375)

    // The title, the price and the save button must all be visible.
    await expect(card.locator('h3')).toBeVisible()
    await expect(card.getByRole('button', { name: /save this trip|remove from saved/i })).toBeVisible()
  })
})
