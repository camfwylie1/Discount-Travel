/**
 * BRANDING — one file to rename the company.
 * Change these values and the entire product follows: page titles, emails,
 * legal pages, OpenGraph tags, the logo mark and the colour system.
 */
export const brand = {
  name: 'Voyaj',
  legalName: 'Voyaj Travel Technologies Inc.',
  tagline: 'Right people. Right trip. Right price.',
  headline: 'Find your people. Then find the trip.',
  subhead:
    'Voyaj is a social network for people who travel. Tell us how you travel, meet travellers who fit, plan trips together — and we’ll search the travel companies for offers that suit all of you.',
  /** One sentence on what we are, used wherever the legal position matters. */
  positioning:
    'Voyaj is a social network and a travel search service. We index offers published by travel companies and link you to them. We never sell travel and we are not part of any booking.',
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
