import { describe, expect, it } from 'vitest'
import { FallbackAiProvider } from './fallback'

const ai = new FallbackAiProvider()

const personalityInput = (radar: Record<string, number>, extra: Partial<Parameters<typeof ai.generateTravelerPersonality>[0]> = {}) => ({
  firstName: 'Robin',
  topLikes: [{ key: 'hiking', label: 'Hiking', rating: 5 }],
  topDislikes: [{ key: 'partying', label: 'Partying', rating: 1 }],
  spectrums: [],
  radar,
  budgetBand: null,
  tripLengthBand: null,
  homeCity: 'Toronto',
  ...extra,
})

describe('the deterministic provider is a real implementation, not a stub', () => {
  it('always answers, with no API key and no network', async () => {
    const result = await ai.generateTravelerPersonality(
      personalityInput({ outdoors: 87, adventure: 77, social: 82, nightlife: 24, culture: 66, food: 50, activity: 45, luxury: 41, wellness: 61, spontaneity: 58 }),
    )
    expect(result.title.length).toBeGreaterThan(3)
    expect(result.description.length).toBeGreaterThan(60)
    expect(result.destinationIdeas.length).toBeGreaterThan(0)
  })

  it('is deterministic — same input, same output', async () => {
    const radar = { outdoors: 80, adventure: 70, social: 40, nightlife: 20, culture: 50, food: 60, activity: 65, luxury: 35, wellness: 45, spontaneity: 55 }
    const a = await ai.generateTravelerPersonality(personalityInput(radar))
    const b = await ai.generateTravelerPersonality(personalityInput(radar))
    expect(a).toEqual(b)
  })
})

describe('the archetype never contradicts the traveller’s own answers', () => {
  it('does not promise nightlife to someone who avoids it', async () => {
    // The exact profile that exposed the original bug: an outdoors-heavy
    // traveller who chose "I'd like to find people" was labelled a Social
    // Adventurer and told about "a bar full of new people at night" — despite
    // scoring 24 on nightlife.
    const result = await ai.generateTravelerPersonality(
      personalityInput({
        outdoors: 87, social: 82, adventure: 77, culture: 66, wellness: 61,
        spontaneity: 58, food: 50, activity: 45, luxury: 41, nightlife: 24,
      }),
    )
    expect(result.description.toLowerCase()).not.toMatch(/bar full of new people|goes late|still going at midnight/)
    expect(result.archetypeKey).toBe('trail-seeker')
  })

  it('does give a night-owl profile to someone who actually is one', async () => {
    const result = await ai.generateTravelerPersonality(
      personalityInput({
        nightlife: 92, social: 88, food: 72, outdoors: 22, activity: 30,
        wellness: 28, adventure: 40, culture: 55, luxury: 60, spontaneity: 60,
      }),
    )
    expect(result.archetypeKey).toBe('night-owl')
  })

  it('recognises a food-led traveller', async () => {
    const result = await ai.generateTravelerPersonality(
      personalityInput({
        food: 94, luxury: 76, wellness: 58, activity: 30, adventure: 25,
        nightlife: 42, outdoors: 35, culture: 62, social: 45, spontaneity: 40,
      }),
    )
    expect(result.archetypeKey).toBe('table-for-two')
  })

  it('calls a genuinely flat profile an all-rounder rather than forcing a label', async () => {
    const flat = Object.fromEntries(
      ['adventure', 'outdoors', 'activity', 'culture', 'food', 'social', 'nightlife', 'luxury', 'wellness', 'spontaneity'].map((k) => [k, 52]),
    )
    const result = await ai.generateTravelerPersonality(personalityInput(flat))
    expect(result.archetypeKey).toBe('all-rounder')
  })

  it('mentions the traveller’s actual stated likes and dislikes', async () => {
    const result = await ai.generateTravelerPersonality(
      personalityInput(
        { outdoors: 85, adventure: 78, activity: 70, nightlife: 25, luxury: 32, culture: 50, food: 55, social: 45, wellness: 50, spontaneity: 50 },
        {
          topLikes: [
            { key: 'hiking', label: 'Hiking', rating: 5 },
            { key: 'wildlife', label: 'Wildlife', rating: 5 },
          ],
          topDislikes: [{ key: 'partying', label: 'Partying', rating: 1 }],
        },
      ),
    )
    expect(result.description.toLowerCase()).toContain('hiking')
    expect(result.description.toLowerCase()).toContain('partying')
  })
})

describe('deal summarisation never invents facts', () => {
  const baseInput = {
    title: 'Costa Rica: Rainforest & Coast',
    description: 'A small-group trip across Costa Rica.',
    destination: 'Costa Rica',
    departureAirport: 'YYZ',
    durationNights: 7,
    inclusions: ['Return flights', '7 nights accommodation'],
    highlightCandidates: ['Hiking', 'Wildlife'],
  }

  it('states only inclusions that were given as true', async () => {
    const result = await ai.summariseDeal({
      ...baseInput,
      facts: {
        airfareIncluded: true, accommodationIncluded: true, mealsIncluded: null,
        activitiesIncluded: null, guideIncluded: null, accommodationType: null,
        groupSizeMax: null, physicalDifficulty: 'NOT_SPECIFIED', tripStyle: [],
      },
    })
    expect(result.summary).toMatch(/flights/i)
    expect(result.summary).toMatch(/accommodation/i)
    // Nothing was said about meals, so nothing may be claimed about meals.
    expect(result.summary).not.toMatch(/meals|guide|activities/i)
  })

  it('says "Not specified" rather than guessing who a trip suits', async () => {
    const result = await ai.summariseDeal({
      ...baseInput,
      facts: {
        airfareIncluded: null, accommodationIncluded: null, mealsIncluded: null,
        activitiesIncluded: null, guideIncluded: null, accommodationType: null,
        groupSizeMax: null, physicalDifficulty: 'NOT_SPECIFIED', tripStyle: [],
      },
    })
    expect(result.bestSuitedTo).toBe('Not specified')
  })

  it('never claims something is NOT included just because the flag is false', async () => {
    const result = await ai.summariseDeal({
      ...baseInput,
      facts: {
        airfareIncluded: false, accommodationIncluded: true, mealsIncluded: false,
        activitiesIncluded: null, guideIncluded: null, accommodationType: null,
        groupSizeMax: null, physicalDifficulty: 'NOT_SPECIFIED', tripStyle: [],
      },
    })
    expect(result.summary).not.toMatch(/not included|excluded|without/i)
    expect(result.summary).toMatch(/accommodation/i)
  })

  it('only uses highlights that were supplied', async () => {
    const result = await ai.summariseDeal({
      ...baseInput,
      highlightCandidates: ['Hiking', 'Wildlife'],
      facts: {
        airfareIncluded: true, accommodationIncluded: true, mealsIncluded: true,
        activitiesIncluded: true, guideIncluded: true, accommodationType: 'Eco-lodges',
        groupSizeMax: 12, physicalDifficulty: 'MODERATE', tripStyle: ['adventure-tour'],
      },
    })
    for (const highlight of result.highlights) {
      expect(['Hiking', 'Wildlife']).toContain(highlight)
    }
  })
})

describe('classification stays inside the controlled vocabulary', () => {
  it('only returns dimensions it was offered', async () => {
    const result = await ai.classifyDeal({
      title: 'Hiking and wine in Tuscany with nightlife in Florence',
      description: 'Trekking, vineyards, museums and bars.',
      destination: 'Italy',
      destinationTraits: [],
      inclusions: [],
      itineraryText: null,
      availableDimensions: [
        { key: 'hiking', label: 'Hiking', category: 'ACTIVITY' },
        { key: 'wine', label: 'Wine', category: 'FOOD_DRINK' },
      ],
    })
    const keys = result.attributes.map((a) => a.key)
    expect(keys.every((k) => ['hiking', 'wine'].includes(k))).toBe(true)
    expect(keys).toContain('hiking')
    expect(keys).toContain('wine')
  })

  it('reports conservative confidence for keyword evidence', async () => {
    const result = await ai.classifyDeal({
      title: 'A hiking trip',
      description: null, destination: 'Peru', destinationTraits: [],
      inclusions: [], itineraryText: null,
      availableDimensions: [{ key: 'hiking', label: 'Hiking', category: 'ACTIVITY' }],
    })
    expect(result.attributes[0]!.confidence).toBeLessThanOrEqual(0.7)
    expect(result.attributes[0]!.evidence).toBeTruthy()
  })

  it('returns nothing rather than guessing when there is no evidence', async () => {
    const result = await ai.classifyDeal({
      title: 'A trip', description: null, destination: 'Somewhere',
      destinationTraits: [], inclusions: [], itineraryText: null,
      availableDimensions: [{ key: 'scuba-diving', label: 'Scuba diving', category: 'ACTIVITY' }],
    })
    expect(result.attributes).toHaveLength(0)
  })
})

describe('match explanations only rephrase, never add', () => {
  it('uses the reasons it was given', async () => {
    const result = await ai.generateMatchExplanation({
      dealTitle: 'Costa Rica', score: 91, firstName: 'Robin',
      reasons: ['Excellent hiking', 'Within your budget'],
      mismatches: ['Limited nightlife'],
    })
    expect(result.paragraph.toLowerCase()).toContain('hiking')
    expect(result.paragraph.toLowerCase()).toContain('nightlife')
  })

  it('stays vague rather than inventing a reason when given none', async () => {
    const result = await ai.generateMatchExplanation({
      dealTitle: 'Somewhere', score: 60, firstName: 'Robin', reasons: [], mismatches: [],
    })
    expect(result.paragraph.length).toBeGreaterThan(10)
    expect(result.paragraph).toMatch(/reasonable fit/i)
  })
})

describe('moderation', () => {
  it('flags contact details without blocking the message', async () => {
    const result = await ai.moderateContent({ text: 'Message me on WhatsApp at 416-555-0199', context: 'message' })
    expect(result.flags).toContain('contact-details')
    expect(result.allowed).toBe(true)
  })

  it('flags a likely scam', async () => {
    const result = await ai.moderateContent({ text: 'Send me the deposit by wire transfer today', context: 'message' })
    expect(result.flags).toContain('possible-scam')
  })

  it('leaves ordinary messages alone', async () => {
    const result = await ai.moderateContent({ text: 'Are you still thinking about February for Costa Rica?', context: 'message' })
    expect(result.flags).toHaveLength(0)
    expect(result.allowed).toBe(true)
  })
})
