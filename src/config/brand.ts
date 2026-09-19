/**
 * BRANDING — one file to rename the company.
 * Change these values and the entire product follows: page titles, emails,
 * legal pages, OpenGraph tags, the logo mark and the colour system.
 */
export const brand = {
  name: 'Voyaj',
  legalName: 'Voyaj Travel Technologies Inc.',
  tagline: 'Right trip. Right people. Right price.',
  headline: 'Find trips you love. Find people you’d actually travel with.',
  subhead:
    'Tell us how you travel. We’ll match you with travel deals, destinations and travellers that fit your personality, budget and schedule.',
  domain: 'voyaj.ca',
  supportEmail: 'hello@voyaj.ca',
  // Colour tokens are declared once in globals.css; these are the semantic names.
  colors: {
    ink: '#14181F',
    terracotta: '#C85A3C',
    ocean: '#1F5C6B',
    sand: '#F6F1E9',
    moss: '#4A6B4F',
    gold: '#C89B3C',
  },
  fonts: {
    display: 'var(--font-display)',
    body: 'var(--font-body)',
  },
  social: { instagram: '', tiktok: '', x: '' },
} as const

export type Brand = typeof brand
