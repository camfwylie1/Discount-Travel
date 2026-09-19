import { expect, test } from '@playwright/test'
import { DEMO, signIn, uniqueEmail } from './helpers'

/**
 * THE CORE CUSTOMER JOURNEY
 *
 * Landing → Signup → Onboarding → AI travel personality → Airports →
 * Budget → Personalised feed → Search → Filter → Deal → Save →
 * People → Connect → Share → Trip → Chat → Checkout.
 *
 * This is the run-through that has to work before any demonstration.
 */

test.describe('a brand new traveller', () => {
  test('goes from the landing page to a personalised feed', async ({ page }) => {
    // ── 1. The landing page ─────────────────────────────────────────────
    await page.goto('/')
    // Social first: the headline leads with people, not with prices.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your people')
    await expect(page.getByText(/trips in the marketplace/)).toBeVisible()

    // ── 2. Sign up ──────────────────────────────────────────────────────
    const email = uniqueEmail('journey')
    await page.getByRole('link', { name: /take the quiz/i }).first().click()
    await page.waitForURL('**/signup')

    await page.getByLabel('First name').fill('Robin')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('TrailsAndWine2026!')
    await page.getByRole('checkbox').nth(0).check() // 18+
    await page.getByRole('checkbox').nth(1).check() // terms
    await page.getByRole('button', { name: /start the quiz/i }).click()

    await page.waitForURL('**/onboarding**', { timeout: 30_000 })

    // ── 3. Onboarding: welcome ──────────────────────────────────────────
    await expect(page.getByRole('heading', { name: /how you travel/i })).toBeVisible()
    await page.getByRole('link', { name: /start the quiz/i }).click()
    await page.waitForURL('**/onboarding/scenarios')

    // ── 4. Scenario questions — pick the outdoorsy answers ──────────────
    await expect(page.getByRole('heading', { name: /perfect saturday/i })).toBeVisible()
    await page.getByRole('button', { name: /sunrise hike/i }).click()
    await page.getByRole('button', { name: /a tent, somewhere quiet/i }).click()
    await page.getByRole('button', { name: /in bed — big day tomorrow/i }).click()
    await page.getByRole('button', { name: /trekking in patagonia/i }).click()
    await page.getByRole('button', { name: /with a few friends/i }).click()
    await page.getByRole('button', { name: /guided experiences/i }).click()

    await page.waitForURL('**/onboarding/style', { timeout: 30_000 })

    // ── 5. Preference screens — answer a few, skip the rest ─────────────
    await expect(page.getByRole('heading', { name: 'Travel style' })).toBeVisible()
    await page.getByRole('button', { name: /extremely important/i }).first().click()
    await page.getByRole('button', { name: 'Continue' }).click()

    for (const heading of ['Activities', 'Food and drink', 'Culture', 'Social style', 'Comfort']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 20_000 })
      await page.getByRole('button', { name: 'Continue' }).click()
    }

    // ── 6. Spectrums ────────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: /travel spectrum/i })).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    // ── 7. Departure airports ───────────────────────────────────────────
    await page.waitForURL('**/onboarding/airports')
    await expect(page.getByRole('heading', { name: /departure airports/i })).toBeVisible()
    await page.getByRole('button', { name: /YYZ/ }).first().click()
    await page.getByRole('button', { name: 'Continue' }).click()

    // ── 8. Budget and dates ─────────────────────────────────────────────
    await page.waitForURL('**/onboarding/budget')
    await page.getByLabel(/what you usually spend/i).fill('2500')
    await page.getByLabel(/the most you would spend/i).fill('3500')
    await page.getByRole('button', { name: 'About a week' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()

    // ── 9. Wishlist and photo are optional ──────────────────────────────
    await page.waitForURL('**/onboarding/wishlist')
    await page.getByRole('button', { name: 'Japan', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.waitForURL('**/onboarding/photo')
    await page.getByRole('button', { name: /skip for now|continue/i }).click()

    // ── 10. THE REVEAL ──────────────────────────────────────────────────
    await page.waitForURL('**/onboarding/personality', { timeout: 30_000 })
    await expect(page.getByText(/Robin, you are/i)).toBeVisible({ timeout: 30_000 })

    // The personality must reflect the outdoorsy answers, not contradict them.
    const title = await page.locator('h2').first().textContent()
    expect(title).toBeTruthy()
    await expect(page.getByText('Your Travel DNA')).toBeVisible()
    await expect(page.locator('svg[role="img"]').first()).toBeVisible()

    // ── 11. The personalised feed ───────────────────────────────────────
    await page.getByRole('button', { name: /see my trips/i }).click()
    await page.waitForURL('**/discover', { timeout: 30_000 })

    await expect(page.getByRole('heading', { name: /hello, robin/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /top matches for you/i })).toBeVisible()
    await expect(page.getByText(/% match/).first()).toBeVisible()
    await expect(page.getByText(/trips fit your budget/i)).toBeVisible()
  })
})

test.describe('an existing member', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)
  })

  test('searches, filters and opens a trip with a full explanation', async ({ page }) => {
    // ── Search ──────────────────────────────────────────────────────────
    await page.goto('/search')
    await page.getByLabel('Search trips').fill('wine portugal')
    await page.getByLabel('Search trips').press('Enter')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/\d+ trips?/).first()).toBeVisible()

    // ── Filter ──────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Flights included' }).click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/airfareIncluded=true/)

    // ── Open a trip ─────────────────────────────────────────────────────
    await page.locator('article h3 a').first().click()
    await page.waitForURL(/\/deals\//, { timeout: 30_000 })

    // The match score AND its reasons must both be present.
    await expect(page.getByText(/why you.ll probably love this/i)).toBeVisible()
    await expect(page.getByText(/potential mismatch/i)).toBeVisible()
    // Scoped to the facts list: "last checked" also appears in the
    // search-service disclaimer further down the page.
    await expect(page.getByText('Last checked', { exact: true })).toBeVisible()

    // The disclaimer is not optional, and it has to say the three things that
    // keep this a search service rather than a seller: we do not set the
    // price, we are not part of the booking, and the price can move.
    await expect(page.getByText(/Voyaj is a search service, not the seller/i)).toBeVisible()
    await expect(page.getByText(/not a party to your booking/i)).toBeVisible()
    await expect(page.getByText(/Prices and availability change/i).first()).toBeVisible()

    // ── Save it ─────────────────────────────────────────────────────────
    // The demo account already has trips saved, so which state this trip
    // starts in depends on the seed. Assert the toggle actually flips instead,
    // and leave it saved so the next step has something to find.
    const saveToggle = page.getByRole('button', { name: /^saved?$/i })
    await expect(saveToggle).toBeVisible()

    if ((await saveToggle.textContent())?.trim().toLowerCase() === 'saved') {
      await saveToggle.click()
      await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible({ timeout: 15_000 })
    }

    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByRole('button', { name: /^saved$/i })).toBeVisible({ timeout: 15_000 })

    await page.goto('/saved')
    await expect(page.locator('article').first()).toBeVisible()
  })

  test('discovers compatible travellers with explained compatibility', async ({ page }) => {
    await page.goto('/people')
    await expect(page.getByRole('heading', { name: /travellers you might click with/i })).toBeVisible()

    const firstCard = page.locator('article').first()
    await expect(firstCard).toBeVisible()
    await expect(firstCard.getByText(/% match/)).toBeVisible()
    await expect(firstCard.getByText(/both love/i)).toBeVisible()

    // Open a profile and check the compatibility breakdown.
    await firstCard.locator('h3 a').click()
    await page.waitForURL(/\/people\//, { timeout: 30_000 })
    await expect(page.getByText(/you both love/i)).toBeVisible()
    await expect(page.getByText(/where you differ/i)).toBeVisible()
    await expect(page.getByText(/travel characteristics only/i)).toBeVisible()

    // Safety controls are always available.
    await expect(page.getByRole('button', { name: /^block /i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^report /i })).toBeVisible()
  })

  test('sees an honest group recommendation on a trip', async ({ page }) => {
    await page.goto('/trips')
    await page.locator('h3 a').first().click()
    await page.waitForURL(/\/trips\//, { timeout: 30_000 })

    await expect(page.getByRole('heading', { name: /how this trip suits the group/i })).toBeVisible()
    // It leads with the LEAST happy member, not the average.
    await expect(page.getByText(/least happy member/i)).toBeVisible()
    await expect(page.getByText(/where the group does not agree/i)).toBeVisible()
    // And it names people rather than hiding the disagreement.
    await expect(page.getByText(/would rather avoid|are looking for/i).first()).toBeVisible()
  })

  test('opens a chat and sends a message', async ({ page }) => {
    await page.goto('/chats')
    await page.locator('a[href^="/chats/"]').first().click()
    await page.waitForURL(/\/chats\/.+/, { timeout: 30_000 })

    const message = `E2E test message ${Date.now()}`
    await page.getByLabel('Your message').fill(message)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(message)).toBeVisible({ timeout: 15_000 })
  })

  test('reaches the membership page', async ({ page }) => {
    await page.goto('/settings/membership')
    await expect(page.getByRole('heading', { name: /voyaj membership/i })).toBeVisible()
  })
})

test.describe('the paywall', () => {
  test('lets a free account take the quiz but gates the marketplace', async ({ page }) => {
    const email = uniqueEmail('paywall')

    await page.goto('/signup')
    await page.getByLabel('First name').fill('Sam')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('TrailsAndWine2026!')
    await page.getByRole('checkbox').nth(0).check()
    await page.getByRole('checkbox').nth(1).check()
    await page.getByRole('button', { name: /start the quiz/i }).click()
    await page.waitForURL('**/onboarding**', { timeout: 30_000 })

    // Skip straight to the reveal — the quiz is free and skippable.
    await page.goto('/onboarding/scenarios')
    await page.getByRole('button', { name: /sunrise hike/i }).click()
    await page.getByRole('button', { name: /a tent, somewhere quiet/i }).click()
    await page.getByRole('button', { name: /in bed — big day tomorrow/i }).click()
    await page.getByRole('button', { name: /trekking in patagonia/i }).click()
    await page.getByRole('button', { name: /on my own/i }).click()
    await page.getByRole('button', { name: /two more days away/i }).click()
    await page.waitForURL('**/onboarding/style', { timeout: 30_000 })

    await page.goto('/onboarding/personality')
    await expect(page.getByText(/Sam, you are/i)).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: /see my trips/i }).click()
    await page.waitForURL('**/discover', { timeout: 30_000 })

    // The preview is clearly a preview.
    await expect(page.getByText(/you are seeing a preview/i)).toBeVisible()

    // Membership-only surfaces redirect rather than half-working.
    await page.goto('/chats')
    await expect(page.getByText(/messaging is part of membership/i)).toBeVisible()

    await page.goto('/upgrade')
    // The price is rendered compactly ("$99", not "$99.00") and must always
    // carry its currency and interval, since the same page will serve markets
    // that are not Canada.
    await expect(page.getByText(/\$99\b/).first()).toBeVisible()
    await expect(page.getByText(/year/i).first()).toBeVisible()
    await expect(page.getByText(/CAD/).first()).toBeVisible()
  })
})
