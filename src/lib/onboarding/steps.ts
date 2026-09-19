/**
 * ONBOARDING FLOW
 *
 * Fourteen short screens rather than one long form. The scenario questions
 * come first and pre-fill the detailed screens, so by the time someone
 * reaches the preference cards they are adjusting answers rather than
 * starting from a blank page. Every step can be skipped and returned to.
 */

export interface OnboardingStep {
  key: string
  title: string
  subtitle: string
  /** Steps that do not count toward the progress bar (intro and reveal). */
  chrome?: boolean
  optional?: boolean
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: 'welcome', title: 'Before we start', subtitle: 'Six minutes, and you can change anything later.', chrome: true },
  { key: 'scenarios', title: 'Six quick questions', subtitle: 'Pick whichever sounds most like you.' },
  { key: 'style', title: 'Travel style', subtitle: 'The kind of trip you look forward to.' },
  { key: 'activities', title: 'Activities', subtitle: 'What you actually want to be doing.' },
  { key: 'food', title: 'Food and drink', subtitle: 'How much eating and drinking well matters.' },
  { key: 'culture', title: 'Culture', subtitle: 'History, art and local life.' },
  { key: 'social', title: 'Social style', subtitle: 'Who you travel with, and how your evenings go.' },
  { key: 'comfort', title: 'Comfort', subtitle: 'Where you sleep and how you get there.' },
  { key: 'spectrums', title: 'Your travel spectrum', subtitle: 'Nine sliders between two extremes.' },
  { key: 'airports', title: 'Departure airports', subtitle: 'Where you actually fly from.' },
  { key: 'budget', title: 'Budget and dates', subtitle: 'What is a genuine limit, and what is just a preference.' },
  { key: 'wishlist', title: 'Your wishlist', subtitle: 'Anywhere you already know you want to go.', optional: true },
  { key: 'photo', title: 'Profile photo', subtitle: 'Optional, and only for other members.', optional: true },
  { key: 'personality', title: 'Your travel personality', subtitle: 'Here is what we make of it.', chrome: true },
]

export const STEP_KEYS = ONBOARDING_STEPS.map((s) => s.key)

/** Which category of preference dimensions each screen shows. */
export const STEP_CATEGORY: Record<string, string> = {
  style: 'TRAVEL_STYLE',
  activities: 'ACTIVITY',
  food: 'FOOD_DRINK',
  culture: 'CULTURE',
  social: 'SOCIAL',
  comfort: 'ACCOMMODATION',
  spectrums: 'SPECTRUM',
}

export function stepIndex(key: string): number {
  return Math.max(0, STEP_KEYS.indexOf(key))
}

export function nextStep(key: string): string | null {
  const i = stepIndex(key)
  return STEP_KEYS[i + 1] ?? null
}

export function previousStep(key: string): string | null {
  const i = stepIndex(key)
  return i > 0 ? (STEP_KEYS[i - 1] ?? null) : null
}

/** Progress excludes the intro and the reveal, which are not questions. */
export function progressFor(key: string): { current: number; total: number; percent: number } {
  const scored = ONBOARDING_STEPS.filter((s) => !s.chrome)
  const index = scored.findIndex((s) => s.key === key)
  const current = index === -1 ? (stepIndex(key) === 0 ? 0 : scored.length) : index + 1
  return {
    current,
    total: scored.length,
    percent: Math.round((current / scored.length) * 100),
  }
}
