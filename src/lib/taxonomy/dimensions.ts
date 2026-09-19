/**
 * PREFERENCE TAXONOMY
 *
 * The complete vocabulary of "things a traveller can care about". This is the
 * seed data for the PreferenceDimension table — after seeding, an
 * administrator edits it in the admin portal, so adding an interest never
 * requires a deploy.
 *
 * `radarAxis` rolls each dimension up into one of the ten Travel DNA axes.
 * `engineWeight` lets a marquee dimension (hiking) count for more than a
 * niche one (tennis) when everything else is equal.
 */

export type RadarAxis =
  | 'adventure'
  | 'social'
  | 'luxury'
  | 'culture'
  | 'food'
  | 'outdoors'
  | 'nightlife'
  | 'wellness'
  | 'spontaneity'
  | 'activity'

export const RADAR_AXES: { key: RadarAxis; label: string }[] = [
  { key: 'adventure', label: 'Adventure' },
  { key: 'outdoors', label: 'Outdoors' },
  { key: 'activity', label: 'Activity' },
  { key: 'culture', label: 'Culture' },
  { key: 'food', label: 'Food & drink' },
  { key: 'social', label: 'Social' },
  { key: 'nightlife', label: 'Nightlife' },
  { key: 'luxury', label: 'Comfort' },
  { key: 'wellness', label: 'Wellness' },
  { key: 'spontaneity', label: 'Spontaneity' },
]

type DimensionCategoryKey =
  | 'TRAVEL_STYLE'
  | 'ACTIVITY'
  | 'FOOD_DRINK'
  | 'CULTURE'
  | 'SOCIAL'
  | 'ACCOMMODATION'
  | 'SPECTRUM'

/** The per-category lists below omit `category`; it is attached when they are merged. */
export type CategorylessSeed = Omit<DimensionSeed, 'category'>

export interface DimensionSeed {
  key: string
  label: string
  category: DimensionCategoryKey
  kind?: 'RATING' | 'SPECTRUM'
  radarAxis?: RadarAxis
  engineWeight?: number
  isCore?: boolean
  description?: string
  poleLowLabel?: string
  poleHighLabel?: string
}

// ── TRAVEL STYLE ────────────────────────────────────────────────────────────
const TRAVEL_STYLE: CategorylessSeed[] = [
  { key: 'adventure', label: 'Adventure', radarAxis: 'adventure', engineWeight: 1.3, isCore: true },
  { key: 'relaxation', label: 'Relaxation', radarAxis: 'wellness', engineWeight: 1.2, isCore: true },
  { key: 'luxury', label: 'Luxury', radarAxis: 'luxury', engineWeight: 1.3, isCore: true },
  { key: 'budget-travel', label: 'Budget travel', radarAxis: 'luxury', engineWeight: 1.1, isCore: true },
  { key: 'backpacking', label: 'Backpacking', radarAxis: 'adventure', engineWeight: 1.0 },
  { key: 'outdoors', label: 'The outdoors', radarAxis: 'outdoors', engineWeight: 1.3, isCore: true },
  { key: 'nature', label: 'Nature', radarAxis: 'outdoors', engineWeight: 1.2, isCore: true },
  { key: 'cities', label: 'Cities', radarAxis: 'culture', engineWeight: 1.2, isCore: true },
  { key: 'beaches', label: 'Beaches', radarAxis: 'wellness', engineWeight: 1.2, isCore: true },
  { key: 'mountains', label: 'Mountains', radarAxis: 'outdoors', engineWeight: 1.2, isCore: true },
  { key: 'countryside', label: 'Countryside', radarAxis: 'outdoors', engineWeight: 1.0 },
  { key: 'road-trips', label: 'Road trips', radarAxis: 'spontaneity', engineWeight: 1.0 },
  { key: 'cruises', label: 'Cruises', radarAxis: 'luxury', engineWeight: 1.1 },
  { key: 'resorts', label: 'Resorts', radarAxis: 'luxury', engineWeight: 1.1 },
  { key: 'all-inclusive', label: 'All-inclusive travel', radarAxis: 'luxury', engineWeight: 1.1 },
  { key: 'guided-tours', label: 'Guided tours', radarAxis: 'culture', engineWeight: 1.0 },
  { key: 'independent-travel', label: 'Independent travel', radarAxis: 'spontaneity', engineWeight: 1.1 },
  { key: 'spontaneous-travel', label: 'Spontaneous travel', radarAxis: 'spontaneity', engineWeight: 1.0 },
  { key: 'structured-itineraries', label: 'Structured itineraries', radarAxis: 'spontaneity', engineWeight: 1.0 },
  { key: 'slow-travel', label: 'Slow travel', radarAxis: 'wellness', engineWeight: 1.0 },
  { key: 'fast-paced-travel', label: 'Fast-paced travel', radarAxis: 'activity', engineWeight: 1.0 },
]

// ── ACTIVITIES ──────────────────────────────────────────────────────────────
const ACTIVITY: CategorylessSeed[] = [
  { key: 'hiking', label: 'Hiking', radarAxis: 'outdoors', engineWeight: 1.4, isCore: true },
  { key: 'biking', label: 'Cycling', radarAxis: 'activity', engineWeight: 1.1 },
  { key: 'mountain-biking', label: 'Mountain biking', radarAxis: 'adventure', engineWeight: 1.0 },
  { key: 'skiing', label: 'Skiing', radarAxis: 'activity', engineWeight: 1.2, isCore: true },
  { key: 'snowboarding', label: 'Snowboarding', radarAxis: 'activity', engineWeight: 1.1 },
  { key: 'surfing', label: 'Surfing', radarAxis: 'adventure', engineWeight: 1.1 },
  { key: 'swimming', label: 'Swimming', radarAxis: 'wellness', engineWeight: 0.9 },
  { key: 'snorkelling', label: 'Snorkelling', radarAxis: 'outdoors', engineWeight: 1.0 },
  { key: 'scuba-diving', label: 'Scuba diving', radarAxis: 'adventure', engineWeight: 1.1 },
  { key: 'kayaking', label: 'Kayaking', radarAxis: 'outdoors', engineWeight: 1.0 },
  { key: 'sailing', label: 'Sailing', radarAxis: 'outdoors', engineWeight: 1.0 },
  { key: 'fishing', label: 'Fishing', radarAxis: 'outdoors', engineWeight: 0.9 },
  { key: 'camping', label: 'Camping', radarAxis: 'outdoors', engineWeight: 1.1 },
  { key: 'wildlife', label: 'Wildlife', radarAxis: 'outdoors', engineWeight: 1.2, isCore: true },
  { key: 'photography', label: 'Photography', radarAxis: 'culture', engineWeight: 1.0 },
  { key: 'running', label: 'Running', radarAxis: 'activity', engineWeight: 0.9 },
  { key: 'fitness', label: 'Fitness', radarAxis: 'activity', engineWeight: 0.9 },
  { key: 'yoga', label: 'Yoga', radarAxis: 'wellness', engineWeight: 1.0 },
  { key: 'golf', label: 'Golf', radarAxis: 'activity', engineWeight: 1.0 },
  { key: 'tennis', label: 'Tennis', radarAxis: 'activity', engineWeight: 0.8 },
  { key: 'water-sports', label: 'Water sports', radarAxis: 'activity', engineWeight: 1.0 },
  { key: 'extreme-sports', label: 'Extreme sports', radarAxis: 'adventure', engineWeight: 1.1 },
  { key: 'wellness', label: 'Wellness', radarAxis: 'wellness', engineWeight: 1.2, isCore: true },
  { key: 'spa', label: 'Spa experiences', radarAxis: 'wellness', engineWeight: 1.1 },
]

// ── FOOD & DRINK ────────────────────────────────────────────────────────────
const FOOD_DRINK: CategorylessSeed[] = [
  { key: 'food', label: 'Food', radarAxis: 'food', engineWeight: 1.4, isCore: true },
  { key: 'fine-dining', label: 'Fine dining', radarAxis: 'luxury', engineWeight: 1.2 },
  { key: 'street-food', label: 'Street food', radarAxis: 'food', engineWeight: 1.1 },
  { key: 'local-cuisine', label: 'Local cuisine', radarAxis: 'food', engineWeight: 1.2, isCore: true },
  { key: 'cooking-classes', label: 'Cooking classes', radarAxis: 'food', engineWeight: 1.0 },
  { key: 'wine', label: 'Wine', radarAxis: 'food', engineWeight: 1.3, isCore: true },
  { key: 'wineries', label: 'Wineries', radarAxis: 'food', engineWeight: 1.2 },
  { key: 'breweries', label: 'Breweries', radarAxis: 'food', engineWeight: 1.0 },
  { key: 'cocktails', label: 'Cocktails', radarAxis: 'nightlife', engineWeight: 1.0 },
  { key: 'night-markets', label: 'Night markets', radarAxis: 'food', engineWeight: 1.0 },
  { key: 'food-tours', label: 'Food tours', radarAxis: 'food', engineWeight: 1.0 },
  { key: 'coffee-culture', label: 'Coffee culture', radarAxis: 'food', engineWeight: 0.9 },
]

// ── CULTURE ─────────────────────────────────────────────────────────────────
const CULTURE: CategorylessSeed[] = [
  { key: 'history', label: 'History', radarAxis: 'culture', engineWeight: 1.3, isCore: true },
  { key: 'museums', label: 'Museums', radarAxis: 'culture', engineWeight: 1.2, isCore: true },
  { key: 'art', label: 'Art', radarAxis: 'culture', engineWeight: 1.1 },
  { key: 'architecture', label: 'Architecture', radarAxis: 'culture', engineWeight: 1.2, isCore: true },
  { key: 'music', label: 'Music', radarAxis: 'nightlife', engineWeight: 1.1 },
  { key: 'live-entertainment', label: 'Live entertainment', radarAxis: 'nightlife', engineWeight: 1.0 },
  { key: 'theatre', label: 'Theatre', radarAxis: 'culture', engineWeight: 0.9 },
  { key: 'festivals', label: 'Festivals', radarAxis: 'social', engineWeight: 1.1 },
  { key: 'local-culture', label: 'Local culture', radarAxis: 'culture', engineWeight: 1.3, isCore: true },
  { key: 'indigenous-culture', label: 'Indigenous culture', radarAxis: 'culture', engineWeight: 1.0 },
  { key: 'religion-spirituality', label: 'Religion & spirituality', radarAxis: 'culture', engineWeight: 0.9 },
  { key: 'archaeology', label: 'Archaeology', radarAxis: 'culture', engineWeight: 1.0 },
  { key: 'unesco-sites', label: 'UNESCO sites', radarAxis: 'culture', engineWeight: 1.0 },
  { key: 'language-immersion', label: 'Language immersion', radarAxis: 'culture', engineWeight: 0.9 },
]

// ── SOCIAL ──────────────────────────────────────────────────────────────────
const SOCIAL: CategorylessSeed[] = [
  { key: 'meeting-new-people', label: 'Meeting new people', radarAxis: 'social', engineWeight: 1.4, isCore: true },
  { key: 'large-groups', label: 'Large groups', radarAxis: 'social', engineWeight: 1.1 },
  { key: 'small-groups', label: 'Small groups', radarAxis: 'social', engineWeight: 1.2, isCore: true },
  { key: 'solo-travel', label: 'Solo travel', radarAxis: 'spontaneity', engineWeight: 1.1 },
  { key: 'couples-travel', label: 'Couples travel', radarAxis: 'social', engineWeight: 1.0 },
  { key: 'group-tours', label: 'Group tours', radarAxis: 'social', engineWeight: 1.0 },
  { key: 'partying', label: 'Partying', radarAxis: 'nightlife', engineWeight: 1.3, isCore: true },
  { key: 'nightlife', label: 'Nightlife', radarAxis: 'nightlife', engineWeight: 1.3, isCore: true },
  { key: 'clubs', label: 'Clubs', radarAxis: 'nightlife', engineWeight: 1.1 },
  { key: 'bars', label: 'Bars', radarAxis: 'nightlife', engineWeight: 1.0 },
  { key: 'quiet-evenings', label: 'Quiet evenings', radarAxis: 'wellness', engineWeight: 1.1 },
  { key: 'social-hostels', label: 'Social hostels', radarAxis: 'social', engineWeight: 1.0 },
  { key: 'organised-activities', label: 'Organised activities', radarAxis: 'social', engineWeight: 0.9 },
  { key: 'local-interactions', label: 'Meeting locals', radarAxis: 'culture', engineWeight: 1.1 },
]

// ── ACCOMMODATION & COMFORT ─────────────────────────────────────────────────
const ACCOMMODATION: CategorylessSeed[] = [
  { key: 'luxury-hotels', label: 'Luxury hotels', radarAxis: 'luxury', engineWeight: 1.3, isCore: true },
  { key: 'boutique-hotels', label: 'Boutique hotels', radarAxis: 'luxury', engineWeight: 1.1 },
  { key: 'resort-stays', label: 'Resort stays', radarAxis: 'luxury', engineWeight: 1.1 },
  { key: 'apartments', label: 'Apartments', radarAxis: 'spontaneity', engineWeight: 1.0 },
  { key: 'hostels', label: 'Hostels', radarAxis: 'social', engineWeight: 1.2, isCore: true },
  { key: 'camping-stays', label: 'Camping', radarAxis: 'outdoors', engineWeight: 1.1 },
  { key: 'glamping', label: 'Glamping', radarAxis: 'outdoors', engineWeight: 1.0 },
  { key: 'unique-stays', label: 'Unique places to stay', radarAxis: 'adventure', engineWeight: 1.0 },
  { key: 'comfortable-transport', label: 'Comfortable transport', radarAxis: 'luxury', engineWeight: 1.0 },
  { key: 'direct-flights', label: 'Direct flights', radarAxis: 'luxury', engineWeight: 1.1 },
  { key: 'premium-flights', label: 'Premium cabins', radarAxis: 'luxury', engineWeight: 1.0 },
  { key: 'private-rooms', label: 'A private room', radarAxis: 'luxury', engineWeight: 1.0 },
]

// ── SPECTRUMS ───────────────────────────────────────────────────────────────
const SPECTRUM: CategorylessSeed[] = [
  { key: 'spectrum-pace', label: 'Pace', kind: 'SPECTRUM', poleLowLabel: 'Relaxed', poleHighLabel: 'Packed itinerary', radarAxis: 'activity', engineWeight: 1.3, isCore: true },
  { key: 'spectrum-rhythm', label: 'Daily rhythm', kind: 'SPECTRUM', poleLowLabel: 'Early mornings', poleHighLabel: 'Late nights', radarAxis: 'nightlife', engineWeight: 1.1, isCore: true },
  { key: 'spectrum-planning', label: 'Planning', kind: 'SPECTRUM', poleLowLabel: 'Planned', poleHighLabel: 'Spontaneous', radarAxis: 'spontaneity', engineWeight: 1.2, isCore: true },
  { key: 'spectrum-guidance', label: 'Guidance', kind: 'SPECTRUM', poleLowLabel: 'Independent', poleHighLabel: 'Guided', radarAxis: 'spontaneity', engineWeight: 1.1 },
  { key: 'spectrum-immersion', label: 'Immersion', kind: 'SPECTRUM', poleLowLabel: 'Local immersion', poleHighLabel: 'Tourist highlights', radarAxis: 'culture', engineWeight: 1.1 },
  { key: 'spectrum-comfort', label: 'Comfort', kind: 'SPECTRUM', poleLowLabel: 'Comfort', poleHighLabel: 'Adventure', radarAxis: 'adventure', engineWeight: 1.3, isCore: true },
  { key: 'spectrum-familiarity', label: 'Familiarity', kind: 'SPECTRUM', poleLowLabel: 'Familiar', poleHighLabel: 'Exotic', radarAxis: 'adventure', engineWeight: 1.1 },
  { key: 'spectrum-sociability', label: 'Sociability', kind: 'SPECTRUM', poleLowLabel: 'Quiet', poleHighLabel: 'Social', radarAxis: 'social', engineWeight: 1.3, isCore: true },
  { key: 'spectrum-spend', label: 'Spending', kind: 'SPECTRUM', poleLowLabel: 'Budget', poleHighLabel: 'Luxury', radarAxis: 'luxury', engineWeight: 1.3, isCore: true },
]

export const DIMENSION_SEEDS: DimensionSeed[] = [
  ...TRAVEL_STYLE.map((d) => ({ ...d, category: 'TRAVEL_STYLE' as const })),
  ...ACTIVITY.map((d) => ({ ...d, category: 'ACTIVITY' as const })),
  ...FOOD_DRINK.map((d) => ({ ...d, category: 'FOOD_DRINK' as const })),
  ...CULTURE.map((d) => ({ ...d, category: 'CULTURE' as const })),
  ...SOCIAL.map((d) => ({ ...d, category: 'SOCIAL' as const })),
  ...ACCOMMODATION.map((d) => ({ ...d, category: 'ACCOMMODATION' as const })),
  ...SPECTRUM.map((d) => ({ ...d, category: 'SPECTRUM' as const, kind: 'SPECTRUM' as const })),
]

export const CATEGORY_META: Record<
  string,
  { label: string; blurb: string; step: string; order: number }
> = {
  TRAVEL_STYLE: {
    label: 'Travel style',
    blurb: 'The kind of trip you look forward to.',
    step: 'style',
    order: 1,
  },
  ACTIVITY: {
    label: 'Activities',
    blurb: 'What you actually want to be doing.',
    step: 'activities',
    order: 2,
  },
  FOOD_DRINK: {
    label: 'Food & drink',
    blurb: 'How much eating and drinking well matters.',
    step: 'food',
    order: 3,
  },
  CULTURE: {
    label: 'Culture',
    blurb: 'History, art and local life.',
    step: 'culture',
    order: 4,
  },
  SOCIAL: {
    label: 'Social style',
    blurb: 'Who you travel with and how your evenings go.',
    step: 'social',
    order: 5,
  },
  ACCOMMODATION: {
    label: 'Comfort',
    blurb: 'Where you sleep and how you get there.',
    step: 'comfort',
    order: 6,
  },
  SPECTRUM: {
    label: 'Your travel spectrum',
    blurb: 'Nine sliders that place you between two extremes.',
    step: 'spectrums',
    order: 7,
  },
}

export const RATING_LABELS: Record<number, { short: string; long: string }> = {
  1: { short: 'Avoid', long: 'Not important — I actively avoid this' },
  2: { short: 'Rarely', long: 'Slight preference against' },
  3: { short: 'Neutral', long: 'Neutral — depends on the trip' },
  4: { short: 'Important', long: 'Important to me' },
  5: { short: 'Essential', long: 'Extremely important' },
}
