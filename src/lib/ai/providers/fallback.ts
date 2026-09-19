import type {
  AiProvider,
  DealClassificationInput,
  DealClassificationOutput,
  DealSummaryInput,
  DealSummaryOutput,
  MatchExplanationInput,
  MatchExplanationOutput,
  ModerationInput,
  ModerationOutput,
  PersonalityInput,
  PersonalityOutput,
  TravelBioInput,
  TravelBioOutput,
} from '../types'

/**
 * DETERMINISTIC FALLBACK PROVIDER
 *
 * This is not a mock and it is not a placeholder — it is a real, shipping
 * implementation that produces genuinely useful copy using templates and
 * rules instead of a language model.
 *
 * It exists so that:
 *   • the product is fully demonstrable with no AI account and no API spend;
 *   • an outage at an AI vendor degrades the product rather than breaking it;
 *   • the automated tests are deterministic.
 *
 * Its output is always labelled as generated, exactly like model output, and
 * it obeys the same rule: it never states a fact that was not in its input.
 */

/**
 * ARCHETYPES
 *
 * Each archetype declares a TARGET profile over the Travel DNA axes, and we
 * pick the one nearest to the traveller's actual radar. An earlier version
 * scored "high axes minus low axes", which could hand someone with a
 * nightlife score of 24 a profile promising "a bar full of new people" — the
 * copy contradicted their own answers. Nearest-profile matching cannot do
 * that, because an axis the archetype implies is always compared against the
 * traveller's real value for it.
 */
interface Archetype {
  key: string
  title: string
  /** Only the axes that actually define this archetype. */
  target: Record<string, number>
  description: string
  companions: string
}

const ARCHETYPES: Archetype[] = [
  {
    key: 'trail-seeker',
    title: 'The Trail Seeker',
    target: { outdoors: 88, adventure: 80, activity: 72, nightlife: 22, luxury: 30 },
    description:
      'Your best days start early and end with tired legs. You want mountains, trails and weather you can feel, and you would rather earn a view than take a lift to it. Comfort matters less to you than being outside.',
    companions: 'Early risers who carry their own pack and do not mind a quiet evening.',
  },
  {
    key: 'social-adventurer',
    title: 'The Social Adventurer',
    target: { adventure: 78, social: 85, nightlife: 68, outdoors: 65, food: 72, luxury: 45 },
    description:
      'You are happiest when a trip has a bit of everything: something active in the morning, local food in the afternoon and a bar full of new people at night. You will trade a little luxury for a better story, but you are not looking to rough it for two weeks either.',
    companions: 'Other people who say yes to things, and who do not need a spreadsheet to enjoy a holiday.',
  },
  {
    key: 'open-road',
    title: 'The Open Road',
    target: { spontaneity: 85, outdoors: 75, adventure: 65, social: 35, nightlife: 25 },
    description:
      'You book the flight and work the rest out later. Fixed itineraries make you itch, and the best parts of your trips are usually the ones nobody planned. You would rather drive it than fly over it.',
    companions: 'People who can change the plan at breakfast without sulking.',
  },
  {
    key: 'table-for-two',
    title: 'The Long Lunch',
    target: { food: 92, luxury: 72, wellness: 55, activity: 32, adventure: 28, nightlife: 40 },
    description:
      'You travel with your appetite. The right meal, the right bottle and an afternoon with nowhere to be is the whole point. You will happily build a week around a region’s food rather than its sights.',
    companions: 'People who book the restaurant before the flight.',
  },
  {
    key: 'culture-wanderer',
    title: 'The Culture Wanderer',
    target: { culture: 90, food: 70, activity: 55, outdoors: 30, nightlife: 35, luxury: 50 },
    description:
      'Old cities, good museums and streets worth getting lost in. You want to understand a place rather than just see it, and you will spend an entire day in one neighbourhood if it is the right one.',
    companions: 'Curious travellers who read the plaque and stay for the second gallery.',
  },
  {
    key: 'sun-and-stillness',
    title: 'Sun and Stillness',
    target: { wellness: 90, activity: 22, adventure: 20, nightlife: 20, outdoors: 45, luxury: 62 },
    description:
      'A holiday is for resting. Warm weather, water nearby and as little on the schedule as possible. You would rather know one beach well than see six in a week.',
    companions: 'People who are genuinely fine doing nothing for an afternoon.',
  },
  {
    key: 'night-owl',
    title: 'The Night Owl',
    target: { nightlife: 92, social: 85, food: 70, outdoors: 25, activity: 35, wellness: 30 },
    description:
      'Your trip really starts after dinner. Cities with a pulse, music that goes late and a group that is up for it. Mornings are negotiable.',
    companions: 'Travellers who are still going at midnight and forgiving about breakfast.',
  },
  {
    key: 'comfort-explorer',
    title: 'The Comfortable Explorer',
    target: { luxury: 85, culture: 72, food: 75, activity: 55, adventure: 45, outdoors: 45 },
    description:
      'You want to see real places, but you want a proper bed at the end of it. Good hotels, good food and a day of genuine exploring in between — you see no contradiction there.',
    companions: 'Travellers who will walk all day and still want somewhere nice to come back to.',
  },
  {
    key: 'quiet-wild',
    title: 'The Quiet Wild',
    target: { outdoors: 88, wellness: 70, nightlife: 12, social: 28, adventure: 55, activity: 50 },
    description:
      'Wide open spaces and not many people in them. You travel for the landscape and the quiet, and an evening with nothing planned is a feature rather than a gap in the itinerary.',
    companions: 'People who are comfortable with long silences and early nights.',
  },
  {
    key: 'all-rounder',
    title: 'The All-Rounder',
    target: {},
    description:
      'You are genuinely open. A good trip is a good trip, whether that is a city, a coast or a mountain range, and you adapt to whoever you are with. That makes you easy to travel with and hard to disappoint.',
    companions: 'Almost anyone — which is a real advantage when a group is deciding.',
  },
]

/**
 * Picks the archetype whose target profile is closest to the traveller's own,
 * measured as mean squared distance across the axes that archetype defines.
 */
function pickArchetype(radar: Record<string, number>): Archetype {
  const allRounder = ARCHETYPES[ARCHETYPES.length - 1]!

  // A genuinely flat profile is an all-rounder, not a weak version of something.
  const values = Object.values(radar)
  if (values.length === 0) return allRounder
  const spread = Math.max(...values) - Math.min(...values)
  if (spread < 20) return allRounder

  let best = allRounder
  let bestDistance = Infinity
  for (const archetype of ARCHETYPES) {
    const axes = Object.keys(archetype.target)
    if (axes.length === 0) continue
    let sum = 0
    for (const axis of axes) {
      const diff = (radar[axis] ?? 50) - archetype.target[axis]!
      sum += diff * diff
    }
    const distance = sum / axes.length
    if (distance < bestDistance) {
      bestDistance = distance
      best = archetype
    }
  }
  // Nothing fits especially well — say so rather than forcing a label.
  return bestDistance > 1200 ? allRounder : best
}

const DESTINATION_IDEAS: Record<string, string[]> = {
  'social-adventurer': ['Costa Rica', 'Portugal', 'Thailand', 'Colombia'],
  'trail-seeker': ['Patagonia', 'The Dolomites', 'Iceland', 'Banff'],
  'quiet-wild': ['Newfoundland', 'Iceland', 'The Scottish Highlands', 'Patagonia'],
  'open-road': ['Iceland', 'New Zealand', 'The Canadian Rockies', 'Portugal'],
  'table-for-two': ['Tuscany', 'Douro Valley', 'Oaxaca', 'San Sebastián'],
  'culture-wanderer': ['Kyoto', 'Andalusia', 'Rome', 'Istanbul'],
  'sun-and-stillness': ['The Algarve', 'Zanzibar', 'Riviera Maya', 'Bali'],
  'night-owl': ['Barcelona', 'Mexico City', 'Lisbon', 'Bangkok'],
  'comfort-explorer': ['Japan', 'Cape Winelands', 'Amalfi Coast', 'Switzerland'],
  'all-rounder': ['Portugal', 'Costa Rica', 'Italy', 'Japan'],
}

function joinNaturally(items: string[], conjunction = 'and'): string {
  const list = items.filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]!
  if (list.length === 2) return `${list[0]} ${conjunction} ${list[1]}`
  return `${list.slice(0, -1).join(', ')} ${conjunction} ${list[list.length - 1]}`
}

export class FallbackAiProvider implements AiProvider {
  readonly name = 'fallback'
  readonly model = null
  readonly available = true

  async generateTravelerPersonality(input: PersonalityInput): Promise<PersonalityOutput> {
    const archetype = pickArchetype(input.radar)
    const likes = input.topLikes.slice(0, 4).map((l) => l.label.toLowerCase())
    const dislikes = input.topDislikes.slice(0, 2).map((l) => l.label.toLowerCase())

    let description = archetype.description
    if (likes.length >= 2) {
      description += ` In practice that means ${joinNaturally(likes)} come near the top of your list`
      description += dislikes.length > 0 ? `, and ${joinNaturally(dislikes, 'or')} come near the bottom.` : '.'
    }
    if (input.budgetBand) {
      description += ` You are typically looking at ${input.budgetBand} trips${input.tripLengthBand ? ` of around ${input.tripLengthBand}` : ''}.`
    }

    return {
      title: archetype.title,
      description,
      topInterests: input.topLikes.slice(0, 6).map((l) => l.label),
      tripStyles: deriveTripStyles(input),
      destinationIdeas: DESTINATION_IDEAS[archetype.key] ?? DESTINATION_IDEAS['all-rounder']!,
      idealCompanions: archetype.companions,
      archetypeKey: archetype.key,
    }
  }

  async summariseDeal(input: DealSummaryInput): Promise<DealSummaryOutput> {
    const parts: string[] = []
    const nights = input.durationNights
    const where = input.destination
    const from = input.departureAirport

    parts.push(
      nights
        ? `${nights} night${nights === 1 ? '' : 's'} in ${where}${from ? ` departing ${from}` : ''}.`
        : `A trip to ${where}${from ? ` departing ${from}` : ''}.`,
    )

    // Only describe what the style and inclusions actually say.
    const styleWords = input.facts.tripStyle.slice(0, 3).map((s) => s.replace(/-/g, ' '))
    const highlightWords = input.highlightCandidates.slice(0, 4).map((h) => h.toLowerCase())
    if (styleWords.length > 0 || highlightWords.length > 0) {
      const focus = joinNaturally([...new Set([...styleWords, ...highlightWords])].slice(0, 4))
      if (focus) parts.push(`This trip focuses on ${focus}.`)
    }

    const included: string[] = []
    if (input.facts.airfareIncluded === true) included.push('flights')
    if (input.facts.accommodationIncluded === true) included.push('accommodation')
    if (input.facts.mealsIncluded === true) included.push('some meals')
    if (input.facts.activitiesIncluded === true) included.push('activities')
    if (input.facts.guideIncluded === true) included.push('a guide')
    if (included.length > 0) parts.push(`${capitalise(joinNaturally(included))} are included.`)

    const bestSuitedTo = describeSuitability(input)
    if (bestSuitedTo) parts.push(bestSuitedTo)

    return {
      summary: parts.join(' '),
      highlights: input.highlightCandidates.slice(0, 5),
      bestSuitedTo: bestSuitedTo || 'Not specified',
    }
  }

  async classifyDeal(input: DealClassificationInput): Promise<DealClassificationOutput> {
    // Keyword matching against the controlled vocabulary. Conservative
    // confidence, because a word appearing in a description is weaker
    // evidence than a provider explicitly stating a fact.
    const haystack = [
      input.title,
      input.description ?? '',
      input.itineraryText ?? '',
      input.inclusions.join(' '),
    ]
      .join(' ')
      .toLowerCase()

    const attributes: DealClassificationOutput['attributes'] = []
    for (const dim of input.availableDimensions) {
      const terms = DIMENSION_KEYWORDS[dim.key] ?? [dim.label.toLowerCase()]
      let hits = 0
      let matched = ''
      for (const term of terms) {
        const count = countOccurrences(haystack, term)
        if (count > 0) {
          hits += count
          if (!matched) matched = term
        }
      }
      if (hits === 0) continue
      attributes.push({
        key: dim.key,
        intensity: Math.min(0.9, 0.55 + hits * 0.1),
        confidence: Math.min(0.7, 0.4 + hits * 0.08),
        evidence: `Mentioned "${matched}" in the listing`,
      })
    }

    return {
      attributes,
      tripStyle: [],
      tags: [],
    }
  }

  async generateMatchExplanation(input: MatchExplanationInput): Promise<MatchExplanationOutput> {
    const reasons = input.reasons.slice(0, 3).map((r) => r.toLowerCase())
    let paragraph =
      reasons.length > 0
        ? `This one lines up with ${joinNaturally(reasons)}.`
        : `This is a reasonable fit for how you travel.`
    if (input.mismatches.length > 0) {
      paragraph += ` Worth knowing: ${joinNaturally(input.mismatches.slice(0, 2).map((m) => m.toLowerCase()))}.`
    }
    return { paragraph }
  }

  async moderateContent(input: ModerationInput): Promise<ModerationOutput> {
    const text = input.text.toLowerCase()
    const flags: string[] = []
    if (CONTACT_PATTERNS.some((re) => re.test(input.text))) flags.push('contact-details')
    if (SLUR_TERMS.some((t) => text.includes(t))) flags.push('hateful-language')
    if (SCAM_PATTERNS.some((re) => re.test(text))) flags.push('possible-scam')
    if (input.text.length > 5000) flags.push('excessive-length')
    // The fallback flags for human review rather than blocking outright, so a
    // false positive never silently loses somebody's message.
    const blocking = flags.includes('hateful-language')
    return {
      allowed: !blocking,
      flags,
      reason: blocking ? 'This message appears to contain hateful language.' : null,
    }
  }

  async generateTravelBio(input: TravelBioInput): Promise<TravelBioOutput> {
    const bits: string[] = []
    bits.push(`${input.personalityTitle}${input.homeCity ? `, based in ${input.homeCity}` : ''}.`)
    if (input.topInterests.length > 0) {
      bits.push(`Mostly travelling for ${joinNaturally(input.topInterests.slice(0, 3).map((i) => i.toLowerCase()))}.`)
    }
    if (input.countriesVisited.length > 0) {
      bits.push(`${input.countriesVisited.length} countries so far.`)
    }
    if (input.wishlist.length > 0) {
      bits.push(`Next on the list: ${joinNaturally(input.wishlist.slice(0, 3))}.`)
    }
    return { bio: bits.join(' ') }
  }
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function countOccurrences(haystack: string, term: string): number {
  if (!term) return 0
  let count = 0
  let index = haystack.indexOf(term)
  while (index !== -1 && count < 5) {
    count += 1
    index = haystack.indexOf(term, index + term.length)
  }
  return count
}

function describeSuitability(input: DealSummaryInput): string {
  const traits: string[] = []
  const style = input.facts.tripStyle.map((s) => s.toLowerCase())
  if (input.facts.physicalDifficulty === 'CHALLENGING' || input.facts.physicalDifficulty === 'STRENUOUS') {
    traits.push('active travellers')
  }
  if (style.includes('all-inclusive') || style.includes('resort')) traits.push('travellers who want everything arranged')
  if (input.facts.groupSizeMax != null && input.facts.groupSizeMax <= 16) traits.push('people who prefer a small group')
  if (style.includes('adventure')) traits.push('travellers who value experience over luxury')
  if (style.includes('food-wine') || style.includes('food')) traits.push('people who travel for the food')
  if (traits.length === 0) return ''
  return `Best suited to ${joinNaturally(traits.slice(0, 2))}.`
}

function deriveTripStyles(input: PersonalityInput): string[] {
  const styles: string[] = []
  const r = input.radar
  if ((r.outdoors ?? 0) > 60) styles.push('Hiking and outdoors')
  if ((r.adventure ?? 0) > 60) styles.push('Adventure tours')
  if ((r.food ?? 0) > 60) styles.push('Food and wine')
  if ((r.culture ?? 0) > 60) styles.push('City and culture breaks')
  if ((r.wellness ?? 0) > 60) styles.push('Beach and wellness')
  if ((r.nightlife ?? 0) > 60) styles.push('Nightlife-friendly cities')
  if ((r.luxury ?? 0) > 65) styles.push('Boutique and luxury stays')
  if ((r.social ?? 0) > 60) styles.push('Small group travel')
  return styles.length > 0 ? styles.slice(0, 5) : ['Flexible — a bit of everything']
}

const CONTACT_PATTERNS = [
  /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/,
  /\b(?:\+?\d[\d\s().-]{7,}\d)\b/,
  /\b(?:whatsapp|telegram|snapchat|instagram|venmo|e-?transfer)\b/i,
]
const SCAM_PATTERNS = [
  /send (?:me )?(?:the )?(?:money|payment|deposit)/i,
  /\bwire transfer\b/i,
  /\bgift card\b/i,
  /click (?:this|the) link to claim/i,
]
// Deliberately minimal. Real moderation uses the model provider's
// safety endpoint; this exists so the fallback is not a no-op.
const SLUR_TERMS: string[] = []

const DIMENSION_KEYWORDS: Record<string, string[]> = {
  hiking: ['hike', 'hiking', 'trek', 'trekking', 'trail', 'summit'],
  biking: ['cycling', 'bike tour', 'cycle'],
  'mountain-biking': ['mountain bike', 'mtb'],
  skiing: ['ski', 'skiing', 'piste', 'powder'],
  snowboarding: ['snowboard'],
  surfing: ['surf', 'surfing', 'surf lesson'],
  swimming: ['swim', 'swimming', 'lagoon'],
  snorkelling: ['snorkel', 'snorkelling', 'snorkeling', 'reef'],
  'scuba-diving': ['scuba', 'dive', 'diving'],
  kayaking: ['kayak', 'canoe', 'paddle'],
  sailing: ['sail', 'sailing', 'catamaran', 'yacht'],
  fishing: ['fishing'],
  camping: ['camp', 'camping', 'campsite'],
  wildlife: ['wildlife', 'safari', 'sloth', 'whale', 'big five', 'birdwatch', 'turtle'],
  photography: ['photography', 'photo tour'],
  yoga: ['yoga'],
  golf: ['golf'],
  wellness: ['wellness', 'retreat', 'thermal', 'hot spring'],
  spa: ['spa', 'massage', 'hammam'],
  'extreme-sports': ['zip line', 'zipline', 'bungee', 'canyoning', 'rafting', 'white water'],
  'water-sports': ['water sports', 'paddleboard', 'jet ski', 'windsurf'],
  food: ['food', 'cuisine', 'culinary', 'gastronom', 'restaurant', 'dining'],
  'fine-dining': ['michelin', 'fine dining', 'tasting menu'],
  'street-food': ['street food', 'market food'],
  'local-cuisine': ['local cuisine', 'traditional dish', 'regional cuisine'],
  'cooking-classes': ['cooking class', 'cookery'],
  wine: ['wine', 'vineyard', 'winery', 'port tasting'],
  wineries: ['winery', 'wineries', 'vineyard', 'cellar'],
  breweries: ['brewery', 'craft beer'],
  cocktails: ['cocktail', 'mixology'],
  'night-markets': ['night market'],
  'food-tours': ['food tour', 'tasting tour'],
  'coffee-culture': ['coffee', 'café', 'cafe culture'],
  history: ['history', 'historic', 'ancient', 'medieval', 'heritage'],
  museums: ['museum', 'gallery'],
  art: ['art', 'artist', 'sculpture'],
  architecture: ['architecture', 'cathedral', 'basilica', 'gaudí', 'gaudi'],
  music: ['music', 'concert', 'jazz', 'fado'],
  'live-entertainment': ['show', 'performance', 'live entertainment'],
  theatre: ['theatre', 'theater'],
  festivals: ['festival', 'carnival'],
  'local-culture': ['local culture', 'village', 'community', 'traditional'],
  'indigenous-culture': ['indigenous', 'first nations', 'maasai', 'quechua'],
  'religion-spirituality': ['temple', 'monastery', 'church', 'shrine', 'spiritual'],
  archaeology: ['archaeolog', 'ruins', 'inca', 'maya', 'roman ruins'],
  'unesco-sites': ['unesco'],
  'language-immersion': ['language', 'spanish lesson', 'immersion'],
  'meeting-new-people': ['meet fellow', 'like-minded', 'solo travellers', 'solo travelers', 'group of'],
  'small-groups': ['small group', 'max 12', 'max 16', 'intimate group'],
  'large-groups': ['large group'],
  'solo-travel': ['solo traveller', 'solo traveler', 'single traveller', 'solo-friendly'],
  'group-tours': ['guided group', 'group tour'],
  partying: ['party', 'club night'],
  nightlife: ['nightlife', 'bar scene', 'night out'],
  clubs: ['nightclub', 'club'],
  bars: ['bar', 'pub', 'taverna'],
  'quiet-evenings': ['quiet', 'peaceful', 'tranquil', 'secluded'],
  'social-hostels': ['hostel'],
  'organised-activities': ['included activities', 'organised', 'organized activities'],
  'local-interactions': ['local guide', 'meet locals', 'homestay'],
  'luxury-hotels': ['5-star', '5 star', 'five-star', 'luxury hotel', 'deluxe'],
  'boutique-hotels': ['boutique'],
  'resort-stays': ['resort'],
  apartments: ['apartment', 'villa', 'self-catering'],
  hostels: ['hostel', 'dorm'],
  'camping-stays': ['camping', 'tented camp'],
  glamping: ['glamping', 'luxury tent'],
  'unique-stays': ['treehouse', 'eco-lodge', 'overwater', 'riad'],
  'comfortable-transport': ['private transfer', 'air-conditioned coach'],
  'direct-flights': ['direct flight', 'non-stop', 'nonstop'],
  'premium-flights': ['business class', 'premium economy'],
  'private-rooms': ['private room', 'en-suite', 'ensuite'],
  adventure: ['adventure', 'expedition', 'off the beaten'],
  relaxation: ['relax', 'unwind', 'leisure', 'downtime'],
  luxury: ['luxury', 'luxurious', 'premium', 'deluxe'],
  'budget-travel': ['budget', 'affordable', 'value'],
  backpacking: ['backpack'],
  outdoors: ['outdoor', 'wilderness', 'national park'],
  nature: ['nature', 'rainforest', 'jungle', 'forest', 'waterfall'],
  cities: ['city', 'cities', 'urban', 'downtown'],
  beaches: ['beach', 'coastline', 'shore', 'sand'],
  mountains: ['mountain', 'alps', 'andes', 'peak', 'volcano'],
  countryside: ['countryside', 'rural', 'farmland'],
  'road-trips': ['road trip', 'self-drive', 'drive yourself'],
  cruises: ['cruise', 'cruising'],
  resorts: ['resort'],
  'all-inclusive': ['all-inclusive', 'all inclusive'],
  'guided-tours': ['guided tour', 'tour leader', 'tour guide'],
  'independent-travel': ['independent', 'at your own pace', 'free time'],
  'slow-travel': ['slow travel', 'unhurried', 'leisurely'],
  'fast-paced-travel': ['fast-paced', 'packed itinerary', 'action-packed'],
}
