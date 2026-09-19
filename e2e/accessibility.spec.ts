import { expect, test } from '@playwright/test'
import { DEMO, signIn } from './helpers'

/**
 * ACCESSIBILITY
 *
 * Not an exhaustive audit, but a floor: every page has one h1, every form
 * control has a label, every image has alt text, and the whole product is
 * reachable with a keyboard.
 */

const PAGES = ['/', '/pricing', '/faq', '/login', '/signup', '/legal/privacy']

test.describe('page structure', () => {
  for (const path of PAGES) {
    test(`${path} has exactly one h1`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('h1')).toHaveCount(1)
    })
  }

  test('every image has alt text', async ({ page }) => {
    await page.goto('/')
    const missing = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter((img) => !img.hasAttribute('alt'))
        .map((img) => img.src)
        .slice(0, 5),
    )
    expect(missing, `Images without alt text: ${missing.join(', ')}`).toHaveLength(0)
  })

  test('every form control has an accessible name', async ({ page }) => {
    await page.goto('/signup')
    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll('input, select, textarea')]
        .filter((el) => {
          if (el.getAttribute('type') === 'hidden') return false
          const id = el.getAttribute('id')
          const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false
          return !hasLabel && !el.getAttribute('aria-label') && !el.closest('label')
        })
        .map((el) => el.outerHTML.slice(0, 80))
        .slice(0, 5),
    )
    expect(unlabelled, `Unlabelled controls:\n${unlabelled.join('\n')}`).toHaveLength(0)
  })
})

test.describe('keyboard use', () => {
  test('a skip link comes first and works', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.textContent)
    expect(focused).toMatch(/skip to main content/i)
  })

  test('the signup form can be completed without a mouse', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('First name').focus()
    await page.keyboard.type('Keyboard')
    await page.keyboard.press('Tab')
    await page.keyboard.type(`kb-${Date.now()}@e2etest.local`)
    await page.keyboard.press('Tab')
    await page.keyboard.type('TrailsAndWine2026!')
    // The checkboxes are reachable and toggleable with the keyboard.
    await page.keyboard.press('Tab')
    await page.keyboard.press('Space')
    const checked = await page.getByRole('checkbox').first().isChecked()
    expect(checked).toBe(true)
  })

  test('focus is visible', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').focus()
    const outline = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      const style = window.getComputedStyle(el)
      return { outlineWidth: style.outlineWidth, boxShadow: style.boxShadow, borderColor: style.borderColor }
    })
    // Either an outline or a visible ring must be present.
    const hasIndicator =
      (outline?.outlineWidth && outline.outlineWidth !== '0px') ||
      (outline?.boxShadow && outline.boxShadow !== 'none')
    expect(hasIndicator).toBeTruthy()
  })
})

test.describe('the Travel DNA chart is not image-only', () => {
  test('exposes its values to a screen reader', async ({ page }) => {
    await signIn(page, DEMO.email, DEMO.password)
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')

    const chart = page.locator('svg[role="img"]').first()
    await expect(chart).toBeVisible()
    await expect(chart).toHaveAttribute('aria-label', /travel dna/i)

    // The same data, readable as text.
    const description = page.locator('figcaption dl').first()
    await expect(description).toHaveCount(1)
  })
})
