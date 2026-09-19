import { expect, type Page } from '@playwright/test'

export const DEMO = {
  email: process.env.DEMO_ACCOUNT_EMAIL ?? 'demo@voyaj.test',
  password: process.env.DEMO_ACCOUNT_PASSWORD ?? 'VoyajDemo!2025',
}

export const ADMIN = {
  email: process.env.ADMIN_ACCOUNT_EMAIL ?? 'admin@voyaj.test',
  password: process.env.ADMIN_ACCOUNT_PASSWORD ?? 'VoyajAdmin!2025',
}

/** A unique address per run, so tests never collide. */
export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@e2etest.local`
}

/**
 * Cookies for accounts this worker has already signed in as.
 *
 * Logging in is rate limited to 8 attempts per address per quarter of an hour,
 * which is the correct production behaviour and is NOT relaxed for tests. A
 * suite that signs in afresh for every case trips that limit partway through
 * and then fails for the rest of the run. So the first sign-in for an account
 * goes through the real form, and the rest of the suite reuses the session
 * cookie it produced — which is also a good deal faster.
 *
 * The login form itself is covered directly by the auth and accessibility
 * suites, so nothing is left untested by this.
 */
const sessionCookies = new Map<string, Awaited<ReturnType<Page['context']>['cookies']>>()

async function signInThroughTheForm(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/(discover|onboarding)/, { timeout: 30_000 })
}

export async function signIn(page: Page, email: string, password: string) {
  const cached = sessionCookies.get(email)

  if (cached) {
    await page.context().addCookies(cached)
    await page.goto('/discover')
    // A cached session can have been revoked by an earlier test (a logout, a
    // password change). If it no longer lands us inside the app, throw it away
    // and sign in properly.
    if (!/\/(discover|onboarding)/.test(page.url())) {
      sessionCookies.delete(email)
      await page.context().clearCookies()
      await signInThroughTheForm(page, email, password)
      sessionCookies.set(email, await page.context().cookies())
    }
    return
  }

  await signInThroughTheForm(page, email, password)
  sessionCookies.set(email, await page.context().cookies())
}

/** Fails the test if the page scrolls sideways — the classic mobile bug. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth }
  })
  expect(
    overflow.scrollWidth,
    `Page scrolls horizontally: content is ${overflow.scrollWidth}px in a ${overflow.clientWidth}px viewport`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1)
}

/**
 * Fails the test if any interactive control is too small to tap reliably.
 *
 * What counts as "the control" is not always the element itself, so this
 * measures the box a thumb can actually land on:
 *
 *  - A checkbox or radio wrapped in a <label> is toggled by tapping anywhere
 *    in that label, so the label's box is the real target, not the 20px box.
 *  - An element hidden with the sr-only clip trick (a skip link, say) cannot
 *    be tapped at all, so its size is meaningless. It is checked for keyboard
 *    users by the accessibility suite instead.
 *  - A link sitting inside a sentence is exempted by WCAG 2.5.8 Target Size
 *    (Minimum), because padding it out would wreck the line it lives in. This
 *    only applies to links with text either side of them - a link that is the
 *    sole content of its container is a button in all but name and is checked.
 */
export async function expectTouchTargets(page: Page, minSize = 40) {
  const tooSmall = await page.evaluate((min) => {
    const results: string[] = []
    const controls = document.querySelectorAll('a[href], button, input, select, textarea, [role="switch"]')

    for (const element of controls) {
      const style = window.getComputedStyle(element)

      if (style.display === 'none' || style.visibility === 'hidden' || element.closest('[aria-hidden="true"]')) continue

      // Clipped out of view (the sr-only pattern): not tappable, not measurable.
      if ((style.clip && style.clip !== 'auto') || (style.clipPath && style.clipPath !== 'none')) continue

      // A wrapping <label> is the tap target for a checkbox or radio.
      const input = element as HTMLInputElement
      const wrappingLabel =
        element.tagName === 'INPUT' && (input.type === 'checkbox' || input.type === 'radio')
          ? element.closest('label')
          : null
      const target = wrappingLabel ?? element

      const rect = target.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue

      // WCAG 2.5.8 exception: a link within a sentence.
      if (element.tagName === 'A' && style.display.startsWith('inline')) {
        const parent = element.parentElement
        const ownText = (element.textContent ?? '').trim().length
        const parentText = (parent?.textContent ?? '').trim().length
        if (parent && parentText > ownText + 4) continue
      }

      if (rect.height < min || rect.width < min) {
        const label =
          element.getAttribute('aria-label') ||
          (element.textContent ?? '').trim().slice(0, 30) ||
          element.getAttribute('name') ||
          ''
        results.push(
          `${element.tagName.toLowerCase()}${label ? ` "${label}"` : ''} is ${Math.round(rect.width)}\u00d7${Math.round(rect.height)}`,
        )
      }
    }
    return results.slice(0, 8)
  }, minSize)

  expect(tooSmall, `Controls smaller than ${minSize}px:\n${tooSmall.join('\n')}`).toHaveLength(0)
}
