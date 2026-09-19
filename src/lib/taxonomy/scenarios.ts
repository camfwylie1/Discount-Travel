/**
 * SCENARIO QUESTIONS
 *
 * The onboarding does not open with fifty sliders. It opens with six quick,
 * visual "what would you actually do?" questions. Each answer writes
 * preference signals, so by the time a traveller reaches the detailed screens
 * their answers are already pre-filled and they are adjusting rather than
 * starting from nothing.
 *
 * `effects` are deltas applied to a neutral 3, clamped to 1..5.
 */

export interface ScenarioSeed {
  key: string
  prompt: string
  helpText?: string
  options: {
    key: string
    label: string
    sublabel?: string
    imageUrl?: string
    effects: Record<string, number>
  }[]
}

export const SCENARIO_SEEDS: ScenarioSeed[] = [
  {
    key: 'perfect-saturday',
    prompt: 'What does your perfect Saturday on holiday look like?',
    helpText: 'Pick the one that sounds most like you.',
    options: [
      {
        key: 'sunrise-hike',
        label: 'A sunrise hike',
        sublabel: 'Up early, boots on, views earned',
        imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=70',
        effects: { hiking: 2, outdoors: 2, mountains: 1.5, adventure: 1.5, nature: 1.5, 'spectrum-rhythm': -30, partying: -1 },
      },
      {
        key: 'cafe-wander',
        label: 'A café and a long wander',
        sublabel: 'No plan, good coffee, side streets',
        imageUrl: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=70',
        effects: { 'coffee-culture': 2, cities: 1.5, 'local-culture': 1.5, architecture: 1, 'spectrum-planning': 25, 'slow-travel': 1 },
      },
      {
        key: 'beach-chair',
        label: 'A beach chair and a book',
        sublabel: 'Sun, sea, absolutely nothing scheduled',
        imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=70',
        effects: { beaches: 2, relaxation: 2, swimming: 1, 'spectrum-pace': -30, wellness: 1, adventure: -1 },
      },
      {
        key: 'winery',
        label: 'An afternoon at a winery',
        sublabel: 'Long lunch, better wine',
        imageUrl: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=70',
        effects: { wine: 2, wineries: 2, food: 1.5, 'fine-dining': 1, countryside: 1, 'slow-travel': 1 },
      },
      {
        key: 'pool-party',
        label: 'A pool party',
        sublabel: 'Music on, people everywhere',
        imageUrl: 'https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=800&q=70',
        effects: { partying: 2, nightlife: 1.5, 'meeting-new-people': 1.5, resorts: 1, 'spectrum-sociability': 30, 'quiet-evenings': -1 },
      },
      {
        key: 'museum-dinner',
        label: 'A museum, then a great dinner',
        sublabel: 'Culture first, table booked for eight',
        imageUrl: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800&q=70',
        effects: { museums: 2, art: 1.5, history: 1.5, 'fine-dining': 1.5, cities: 1, food: 1 },
      },
    ],
  },
  {
    key: 'where-you-sleep',
    prompt: 'After a long travel day, where do you want to be sleeping?',
    options: [
      {
        key: 'boutique',
        label: 'A characterful boutique hotel',
        effects: { 'boutique-hotels': 2, 'local-culture': 1, 'spectrum-spend': 15, 'unique-stays': 1 },
      },
      {
        key: 'five-star',
        label: 'A proper five-star hotel',
        effects: { 'luxury-hotels': 2, luxury: 2, 'spectrum-spend': 35, spa: 1, 'budget-travel': -1 },
      },
      {
        key: 'hostel',
        label: 'A social hostel with a good bar',
        effects: { hostels: 2, 'social-hostels': 2, 'meeting-new-people': 2, 'budget-travel': 1.5, 'spectrum-spend': -30, luxury: -1 },
      },
      {
        key: 'tent',
        label: 'A tent, somewhere quiet',
        effects: { 'camping-stays': 2, camping: 2, outdoors: 2, nature: 1.5, 'spectrum-comfort': 30, luxury: -1.5 },
      },
      {
        key: 'apartment',
        label: 'An apartment where I can cook',
        effects: { apartments: 2, 'local-culture': 1, 'slow-travel': 1.5, 'local-cuisine': 1 },
      },
      {
        key: 'resort',
        label: 'An all-inclusive resort',
        effects: { resorts: 2, 'all-inclusive': 2, 'resort-stays': 2, relaxation: 1.5, beaches: 1 },
      },
    ],
  },
  {
    key: 'evening-style',
    prompt: 'It’s 10pm on the third night. Where are you?',
    options: [
      {
        key: 'bar-crawl',
        label: 'Out, and it’s just getting going',
        effects: { nightlife: 2, clubs: 1.5, bars: 1.5, partying: 1.5, 'spectrum-rhythm': 35, 'quiet-evenings': -1.5 },
      },
      {
        key: 'late-dinner',
        label: 'Still at dinner, third bottle',
        effects: { food: 1.5, wine: 1.5, 'fine-dining': 1, bars: 0.5, 'spectrum-rhythm': 15 },
      },
      {
        key: 'live-music',
        label: 'At a live music venue',
        effects: { music: 2, 'live-entertainment': 1.5, 'local-culture': 1, nightlife: 1 },
      },
      {
        key: 'early-night',
        label: 'In bed — big day tomorrow',
        effects: { 'quiet-evenings': 2, 'spectrum-rhythm': -35, hiking: 0.5, wellness: 1, partying: -1.5, clubs: -1 },
      },
    ],
  },
  {
    key: 'trip-shape',
    prompt: 'Which of these trips would you book tomorrow?',
    options: [
      {
        key: 'patagonia',
        label: 'Ten days trekking in Patagonia',
        effects: { hiking: 2, adventure: 2, mountains: 2, outdoors: 1.5, 'spectrum-comfort': 30, 'spectrum-pace': 20 },
      },
      {
        key: 'italy-food',
        label: 'A week eating through Italy',
        effects: { food: 2, wine: 2, 'local-cuisine': 1.5, history: 1, architecture: 1, 'food-tours': 1.5 },
      },
      {
        key: 'japan-cities',
        label: 'Two weeks across Japanese cities',
        effects: { cities: 2, 'local-culture': 2, food: 1.5, architecture: 1.5, 'language-immersion': 1, 'spectrum-familiarity': 30 },
      },
      {
        key: 'safari',
        label: 'A safari in Tanzania',
        effects: { wildlife: 2, nature: 2, photography: 1.5, adventure: 1.5, 'guided-tours': 1 },
      },
      {
        key: 'greek-islands',
        label: 'Island-hopping in Greece',
        effects: { beaches: 2, swimming: 1.5, relaxation: 1.5, sailing: 1, 'spectrum-planning': 20 },
      },
      {
        key: 'ski-alps',
        label: 'A ski week in the Alps',
        effects: { skiing: 2, snowboarding: 1, mountains: 2, 'spectrum-pace': 15, 'comfortable-transport': 0.5 },
      },
    ],
  },
  {
    key: 'who-with',
    prompt: 'Who are you most likely to be travelling with?',
    helpText: 'This only shapes your recommendations — you can change it any time.',
    options: [
      {
        key: 'solo',
        label: 'On my own',
        effects: { 'solo-travel': 2, 'meeting-new-people': 1, 'spectrum-planning': 15 },
      },
      {
        key: 'partner',
        label: 'With my partner',
        effects: { 'couples-travel': 2, 'private-rooms': 1, 'quiet-evenings': 0.5 },
      },
      {
        key: 'friends',
        label: 'With a few friends',
        effects: { 'small-groups': 2, 'meeting-new-people': 0.5, 'spectrum-sociability': 20 },
      },
      {
        key: 'group',
        label: 'With a big group',
        effects: { 'large-groups': 2, 'organised-activities': 1, 'spectrum-sociability': 30 },
      },
      {
        key: 'open',
        label: 'I’d like to find people',
        effects: { 'meeting-new-people': 2, 'group-tours': 1.5, 'small-groups': 1.5, 'social-hostels': 1 },
      },
    ],
  },
  {
    key: 'trade-off',
    prompt: 'You have an extra $500. What do you spend it on?',
    options: [
      {
        key: 'better-hotel',
        label: 'A much better hotel',
        effects: { 'luxury-hotels': 2, luxury: 1.5, 'spectrum-spend': 25, 'comfortable-transport': 1 },
      },
      {
        key: 'more-days',
        label: 'Two more days away',
        effects: { 'slow-travel': 2, 'budget-travel': 1, 'spectrum-spend': -15 },
      },
      {
        key: 'experiences',
        label: 'Guided experiences and activities',
        effects: { 'organised-activities': 1.5, 'guided-tours': 1.5, adventure: 1, 'spectrum-guidance': 25 },
      },
      {
        key: 'restaurants',
        label: 'Restaurants I’d otherwise skip',
        effects: { 'fine-dining': 2, food: 1.5, wine: 1 },
      },
      {
        key: 'direct-flight',
        label: 'A direct flight and a better seat',
        effects: { 'direct-flights': 2, 'premium-flights': 1.5, 'comfortable-transport': 1.5 },
      },
    ],
  },
]
