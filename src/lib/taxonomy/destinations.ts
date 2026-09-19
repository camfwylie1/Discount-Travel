/**
 * DESTINATIONS
 *
 * A tree: continent → country → region/city. `traits` give the engine a
 * sensible starting point for a deal whose provider told us almost nothing —
 * a trip to Banff is an outdoors trip even if the listing never says so.
 * These are *rules*, recorded with a lower confidence than facts the provider
 * actually stated.
 */
export interface DestinationSeed {
  slug: string
  name: string
  kind: 'CONTINENT' | 'COUNTRY' | 'REGION' | 'CITY' | 'AREA'
  parent?: string
  country?: string
  countryName?: string
  continent?: string
  latitude?: number
  longitude?: number
  traits?: string[]
  blurb?: string
  heroImageUrl?: string
}

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=72`

export const DESTINATION_SEEDS: DestinationSeed[] = [
  // ── Continents
  { slug: 'north-america', name: 'North America', kind: 'CONTINENT' },
  { slug: 'central-america', name: 'Central America', kind: 'CONTINENT' },
  { slug: 'south-america', name: 'South America', kind: 'CONTINENT' },
  { slug: 'europe', name: 'Europe', kind: 'CONTINENT' },
  { slug: 'asia', name: 'Asia', kind: 'CONTINENT' },
  { slug: 'africa', name: 'Africa', kind: 'CONTINENT' },
  { slug: 'oceania', name: 'Oceania', kind: 'CONTINENT' },
  { slug: 'caribbean', name: 'The Caribbean', kind: 'CONTINENT' },

  // ── Countries
  { slug: 'costa-rica', name: 'Costa Rica', kind: 'COUNTRY', parent: 'central-america', country: 'CR', countryName: 'Costa Rica', continent: 'Central America', latitude: 9.7489, longitude: -83.7534, traits: ['nature', 'adventure', 'wildlife', 'beach', 'warm'], blurb: 'Rainforest, volcanoes and two coastlines in a country the size of Nova Scotia.', heroImageUrl: img('1536513879909-3c7a3a7c8e2b') },
  { slug: 'mexico', name: 'Mexico', kind: 'COUNTRY', parent: 'north-america', country: 'MX', countryName: 'Mexico', continent: 'North America', latitude: 23.6345, longitude: -102.5528, traits: ['beach', 'food', 'culture', 'warm', 'nightlife'], blurb: 'Beach resorts, colonial cities and one of the world’s great food cultures.', heroImageUrl: img('1518638150340-f706e86654de') },
  { slug: 'portugal', name: 'Portugal', kind: 'COUNTRY', parent: 'europe', country: 'PT', countryName: 'Portugal', continent: 'Europe', latitude: 39.3999, longitude: -8.2245, traits: ['food', 'wine', 'culture', 'coast', 'walkable'], blurb: 'Tiled cities, Atlantic surf and the best-value wine in Europe.', heroImageUrl: img('1555881400-74d7acaacd8b') },
  { slug: 'italy', name: 'Italy', kind: 'COUNTRY', parent: 'europe', country: 'IT', countryName: 'Italy', continent: 'Europe', latitude: 41.8719, longitude: 12.5674, traits: ['food', 'wine', 'history', 'art', 'culture'], blurb: 'Art, ruins, mountains and the food you will talk about for years.', heroImageUrl: img('1523906834658-6e24ef2386f9') },
  { slug: 'spain', name: 'Spain', kind: 'COUNTRY', parent: 'europe', country: 'ES', countryName: 'Spain', continent: 'Europe', latitude: 40.4637, longitude: -3.7492, traits: ['food', 'nightlife', 'culture', 'beach', 'architecture'], blurb: 'Late dinners, Moorish architecture and beaches on three seas.', heroImageUrl: img('1539037116277-4db20889f2d4') },
  { slug: 'greece', name: 'Greece', kind: 'COUNTRY', parent: 'europe', country: 'GR', countryName: 'Greece', continent: 'Europe', latitude: 39.0742, longitude: 21.8243, traits: ['beach', 'history', 'island', 'warm', 'food'], blurb: 'Six thousand islands, and the ruins that started most of it.', heroImageUrl: img('1533105079780-92b9be482077') },
  { slug: 'iceland', name: 'Iceland', kind: 'COUNTRY', parent: 'europe', country: 'IS', countryName: 'Iceland', continent: 'Europe', latitude: 64.9631, longitude: -19.0208, traits: ['nature', 'adventure', 'outdoors', 'cold', 'photography'], blurb: 'Waterfalls, glaciers and the northern lights, four hours from Toronto.', heroImageUrl: img('1504829857797-ddff29c27927') },
  { slug: 'japan', name: 'Japan', kind: 'COUNTRY', parent: 'asia', country: 'JP', countryName: 'Japan', continent: 'Asia', latitude: 36.2048, longitude: 138.2529, traits: ['culture', 'food', 'city', 'history', 'exotic'], blurb: 'Where the oldest traditions and the newest cities share a train line.', heroImageUrl: img('1493976040374-85c8e12f0c0e') },
  { slug: 'thailand', name: 'Thailand', kind: 'COUNTRY', parent: 'asia', country: 'TH', countryName: 'Thailand', continent: 'Asia', latitude: 15.87, longitude: 100.9925, traits: ['beach', 'food', 'budget', 'nightlife', 'warm'], blurb: 'Street food, island beaches and temples, on almost any budget.', heroImageUrl: img('1528181304800-259b08848526') },
  { slug: 'indonesia', name: 'Indonesia', kind: 'COUNTRY', parent: 'asia', country: 'ID', countryName: 'Indonesia', continent: 'Asia', latitude: -0.7893, longitude: 113.9213, traits: ['beach', 'wellness', 'surf', 'budget', 'warm'], blurb: 'Seventeen thousand islands, and surf on most of them.', heroImageUrl: img('1537996194471-e657df975ab4') },
  { slug: 'peru', name: 'Peru', kind: 'COUNTRY', parent: 'south-america', country: 'PE', countryName: 'Peru', continent: 'South America', latitude: -9.19, longitude: -75.0152, traits: ['adventure', 'history', 'hiking', 'culture', 'archaeology'], blurb: 'The Andes, the Amazon and the best food in South America.', heroImageUrl: img('1526392060635-9d6019884377') },
  { slug: 'chile', name: 'Chile', kind: 'COUNTRY', parent: 'south-america', country: 'CL', countryName: 'Chile', continent: 'South America', latitude: -35.6751, longitude: -71.543, traits: ['adventure', 'hiking', 'wine', 'nature', 'mountains'], blurb: 'Desert to glacier, four thousand kilometres of it.', heroImageUrl: img('1478827387698-1527781a4887') },
  { slug: 'tanzania', name: 'Tanzania', kind: 'COUNTRY', parent: 'africa', country: 'TZ', countryName: 'Tanzania', continent: 'Africa', latitude: -6.369, longitude: 34.8888, traits: ['wildlife', 'adventure', 'nature', 'photography', 'exotic'], blurb: 'The Serengeti, Kilimanjaro and Zanzibar, in one country.', heroImageUrl: img('1516426122078-c23e76319801') },
  { slug: 'south-africa', name: 'South Africa', kind: 'COUNTRY', parent: 'africa', country: 'ZA', countryName: 'South Africa', continent: 'Africa', latitude: -30.5595, longitude: 22.9375, traits: ['wildlife', 'wine', 'adventure', 'coast', 'city'], blurb: 'Safari, wine country and a city under a mountain.', heroImageUrl: img('1580060839134-75a5edca2e99') },
  { slug: 'dominican-republic', name: 'Dominican Republic', kind: 'COUNTRY', parent: 'caribbean', country: 'DO', countryName: 'Dominican Republic', continent: 'Caribbean', latitude: 18.7357, longitude: -70.1627, traits: ['beach', 'resort', 'all-inclusive', 'warm', 'nightlife'], blurb: 'The Caribbean all-inclusive heartland, and a mountain range behind it.', heroImageUrl: img('1544551763-46a013bb70d5') },
  { slug: 'jamaica', name: 'Jamaica', kind: 'COUNTRY', parent: 'caribbean', country: 'JM', countryName: 'Jamaica', continent: 'Caribbean', latitude: 18.1096, longitude: -77.2975, traits: ['beach', 'music', 'resort', 'warm', 'nightlife'], blurb: 'Beaches, waterfalls and the best soundtrack in the Caribbean.', heroImageUrl: img('1580237072353-751a8a5b2561') },
  { slug: 'canada', name: 'Canada', kind: 'COUNTRY', parent: 'north-america', country: 'CA', countryName: 'Canada', continent: 'North America', latitude: 56.1304, longitude: -106.3468, traits: ['outdoors', 'nature', 'mountains', 'domestic', 'road-trip'], blurb: 'The trip you can drive to.', heroImageUrl: img('1609825488888-3a766db05542') },
  { slug: 'france', name: 'France', kind: 'COUNTRY', parent: 'europe', country: 'FR', countryName: 'France', continent: 'Europe', latitude: 46.2276, longitude: 2.2137, traits: ['food', 'wine', 'culture', 'art', 'romantic'], blurb: 'Wine regions, alpine passes and the museums everyone else copies.', heroImageUrl: img('1502602898657-3e91760cbb34') },
  { slug: 'switzerland', name: 'Switzerland', kind: 'COUNTRY', parent: 'europe', country: 'CH', countryName: 'Switzerland', continent: 'Europe', latitude: 46.8182, longitude: 8.2275, traits: ['mountains', 'hiking', 'skiing', 'luxury', 'outdoors'], blurb: 'The Alps, with trains that actually run on time.', heroImageUrl: img('1530122037265-a5f1f91d3b99') },
  { slug: 'united-kingdom', name: 'United Kingdom', kind: 'COUNTRY', parent: 'europe', country: 'GB', countryName: 'United Kingdom', continent: 'Europe', latitude: 55.3781, longitude: -3.436, traits: ['history', 'city', 'culture', 'walkable'], blurb: 'Cities, coastline and more history than anywhere should have.', heroImageUrl: img('1513635269975-59663e0ac1ad') },

  // ── Regions and cities
  { slug: 'guanacaste', name: 'Guanacaste', kind: 'REGION', parent: 'costa-rica', country: 'CR', continent: 'Central America', latitude: 10.6267, longitude: -85.4377, traits: ['beach', 'surf', 'resort', 'warm'] },
  { slug: 'la-fortuna', name: 'La Fortuna & Arenal', kind: 'AREA', parent: 'costa-rica', country: 'CR', continent: 'Central America', latitude: 10.4678, longitude: -84.6427, traits: ['adventure', 'nature', 'hiking', 'wildlife'] },
  { slug: 'monteverde', name: 'Monteverde', kind: 'AREA', parent: 'costa-rica', country: 'CR', continent: 'Central America', latitude: 10.3009, longitude: -84.8222, traits: ['nature', 'wildlife', 'hiking'] },
  { slug: 'lisbon', name: 'Lisbon', kind: 'CITY', parent: 'portugal', country: 'PT', continent: 'Europe', latitude: 38.7223, longitude: -9.1393, traits: ['city', 'food', 'culture', 'walkable', 'nightlife'] },
  { slug: 'porto', name: 'Porto', kind: 'CITY', parent: 'portugal', country: 'PT', continent: 'Europe', latitude: 41.1579, longitude: -8.6291, traits: ['city', 'wine', 'food', 'walkable'] },
  { slug: 'douro-valley', name: 'Douro Valley', kind: 'REGION', parent: 'portugal', country: 'PT', continent: 'Europe', latitude: 41.1621, longitude: -7.7891, traits: ['wine', 'countryside', 'slow', 'food'] },
  { slug: 'algarve', name: 'The Algarve', kind: 'REGION', parent: 'portugal', country: 'PT', continent: 'Europe', latitude: 37.0194, longitude: -7.9304, traits: ['beach', 'golf', 'coast', 'warm'] },
  { slug: 'tuscany', name: 'Tuscany', kind: 'REGION', parent: 'italy', country: 'IT', continent: 'Europe', latitude: 43.7711, longitude: 11.2486, traits: ['wine', 'food', 'countryside', 'art', 'slow'] },
  { slug: 'amalfi-coast', name: 'Amalfi Coast', kind: 'REGION', parent: 'italy', country: 'IT', continent: 'Europe', latitude: 40.634, longitude: 14.6027, traits: ['coast', 'food', 'luxury', 'romantic'] },
  { slug: 'dolomites', name: 'The Dolomites', kind: 'REGION', parent: 'italy', country: 'IT', continent: 'Europe', latitude: 46.4102, longitude: 11.8440, traits: ['mountains', 'hiking', 'outdoors', 'skiing'] },
  { slug: 'rome', name: 'Rome', kind: 'CITY', parent: 'italy', country: 'IT', continent: 'Europe', latitude: 41.9028, longitude: 12.4964, traits: ['history', 'city', 'food', 'art', 'archaeology'] },
  { slug: 'barcelona', name: 'Barcelona', kind: 'CITY', parent: 'spain', country: 'ES', continent: 'Europe', latitude: 41.3851, longitude: 2.1734, traits: ['city', 'architecture', 'beach', 'nightlife', 'food'] },
  { slug: 'andalusia', name: 'Andalusia', kind: 'REGION', parent: 'spain', country: 'ES', continent: 'Europe', latitude: 37.5443, longitude: -4.7278, traits: ['history', 'architecture', 'food', 'warm', 'culture'] },
  { slug: 'santorini', name: 'Santorini', kind: 'CITY', parent: 'greece', country: 'GR', continent: 'Europe', latitude: 36.3932, longitude: 25.4615, traits: ['island', 'beach', 'romantic', 'luxury'] },
  { slug: 'cyclades', name: 'The Cyclades', kind: 'REGION', parent: 'greece', country: 'GR', continent: 'Europe', latitude: 37.0, longitude: 25.1667, traits: ['island', 'beach', 'nightlife', 'sailing'] },
  { slug: 'reykjavik', name: 'Reykjavík', kind: 'CITY', parent: 'iceland', country: 'IS', continent: 'Europe', latitude: 64.1466, longitude: -21.9426, traits: ['city', 'nature', 'photography'] },
  { slug: 'tokyo', name: 'Tokyo', kind: 'CITY', parent: 'japan', country: 'JP', continent: 'Asia', latitude: 35.6762, longitude: 139.6503, traits: ['city', 'food', 'culture', 'nightlife', 'exotic'] },
  { slug: 'kyoto', name: 'Kyoto', kind: 'CITY', parent: 'japan', country: 'JP', continent: 'Asia', latitude: 35.0116, longitude: 135.7681, traits: ['culture', 'history', 'temples', 'walkable'] },
  { slug: 'bali', name: 'Bali', kind: 'REGION', parent: 'indonesia', country: 'ID', continent: 'Asia', latitude: -8.3405, longitude: 115.092, traits: ['beach', 'wellness', 'surf', 'yoga', 'budget'] },
  { slug: 'bangkok', name: 'Bangkok', kind: 'CITY', parent: 'thailand', country: 'TH', continent: 'Asia', latitude: 13.7563, longitude: 100.5018, traits: ['city', 'food', 'nightlife', 'budget'] },
  { slug: 'chiang-mai', name: 'Chiang Mai', kind: 'CITY', parent: 'thailand', country: 'TH', continent: 'Asia', latitude: 18.7883, longitude: 98.9853, traits: ['culture', 'food', 'budget', 'nature'] },
  { slug: 'cusco', name: 'Cusco & the Sacred Valley', kind: 'REGION', parent: 'peru', country: 'PE', continent: 'South America', latitude: -13.5319, longitude: -71.9675, traits: ['history', 'hiking', 'archaeology', 'culture', 'adventure'] },
  { slug: 'patagonia', name: 'Patagonia', kind: 'REGION', parent: 'chile', country: 'CL', continent: 'South America', latitude: -50.9423, longitude: -73.4068, traits: ['hiking', 'adventure', 'mountains', 'outdoors', 'nature'] },
  { slug: 'serengeti', name: 'Serengeti', kind: 'REGION', parent: 'tanzania', country: 'TZ', continent: 'Africa', latitude: -2.3333, longitude: 34.8333, traits: ['wildlife', 'photography', 'nature', 'exotic'] },
  { slug: 'zanzibar', name: 'Zanzibar', kind: 'REGION', parent: 'tanzania', country: 'TZ', continent: 'Africa', latitude: -6.1659, longitude: 39.2026, traits: ['beach', 'island', 'warm', 'culture'] },
  { slug: 'cape-winelands', name: 'Cape Winelands', kind: 'REGION', parent: 'south-africa', country: 'ZA', continent: 'Africa', latitude: -33.9321, longitude: 18.8602, traits: ['wine', 'food', 'countryside', 'luxury'] },
  { slug: 'banff', name: 'Banff & Lake Louise', kind: 'AREA', parent: 'canada', country: 'CA', continent: 'North America', latitude: 51.1784, longitude: -115.5708, traits: ['mountains', 'hiking', 'outdoors', 'skiing', 'domestic'] },
  { slug: 'newfoundland', name: 'Newfoundland', kind: 'REGION', parent: 'canada', country: 'CA', continent: 'North America', latitude: 48.9597, longitude: -55.6602, traits: ['outdoors', 'coast', 'hiking', 'domestic', 'culture'] },
  { slug: 'quebec-city', name: 'Québec City', kind: 'CITY', parent: 'canada', country: 'CA', continent: 'North America', latitude: 46.8139, longitude: -71.208, traits: ['history', 'city', 'food', 'walkable', 'domestic'] },
  { slug: 'riviera-maya', name: 'Riviera Maya', kind: 'REGION', parent: 'mexico', country: 'MX', continent: 'North America', latitude: 20.6296, longitude: -87.0739, traits: ['beach', 'resort', 'all-inclusive', 'warm', 'archaeology'] },
  { slug: 'oaxaca', name: 'Oaxaca', kind: 'CITY', parent: 'mexico', country: 'MX', continent: 'North America', latitude: 17.0732, longitude: -96.7266, traits: ['food', 'culture', 'history', 'art'] },
  { slug: 'french-alps', name: 'French Alps', kind: 'REGION', parent: 'france', country: 'FR', continent: 'Europe', latitude: 45.8992, longitude: 6.1294, traits: ['skiing', 'mountains', 'hiking', 'outdoors'] },
  { slug: 'provence', name: 'Provence', kind: 'REGION', parent: 'france', country: 'FR', continent: 'Europe', latitude: 43.9352, longitude: 6.0679, traits: ['wine', 'food', 'countryside', 'slow'] },
  { slug: 'punta-cana', name: 'Punta Cana', kind: 'AREA', parent: 'dominican-republic', country: 'DO', continent: 'Caribbean', latitude: 18.582, longitude: -68.4055, traits: ['beach', 'resort', 'all-inclusive', 'warm'] },
  { slug: 'montego-bay', name: 'Montego Bay', kind: 'AREA', parent: 'jamaica', country: 'JM', continent: 'Caribbean', latitude: 18.4762, longitude: -77.8939, traits: ['beach', 'resort', 'all-inclusive', 'music'] },
]

/** Maps a destination trait onto preference dimensions, with a confidence. */
export const TRAIT_TO_DIMENSIONS: Record<string, { key: string; intensity: number }[]> = {
  beach: [{ key: 'beaches', intensity: 0.9 }, { key: 'swimming', intensity: 0.75 }, { key: 'relaxation', intensity: 0.7 }],
  mountains: [{ key: 'mountains', intensity: 0.9 }, { key: 'outdoors', intensity: 0.8 }, { key: 'hiking', intensity: 0.7 }],
  hiking: [{ key: 'hiking', intensity: 0.9 }, { key: 'outdoors', intensity: 0.85 }, { key: 'nature', intensity: 0.75 }],
  outdoors: [{ key: 'outdoors', intensity: 0.85 }, { key: 'nature', intensity: 0.8 }],
  nature: [{ key: 'nature', intensity: 0.9 }, { key: 'outdoors', intensity: 0.75 }],
  wildlife: [{ key: 'wildlife', intensity: 0.92 }, { key: 'nature', intensity: 0.8 }, { key: 'photography', intensity: 0.65 }],
  adventure: [{ key: 'adventure', intensity: 0.85 }],
  food: [{ key: 'food', intensity: 0.85 }, { key: 'local-cuisine', intensity: 0.75 }],
  wine: [{ key: 'wine', intensity: 0.9 }, { key: 'wineries', intensity: 0.85 }],
  culture: [{ key: 'local-culture', intensity: 0.85 }, { key: 'history', intensity: 0.6 }],
  history: [{ key: 'history', intensity: 0.9 }, { key: 'museums', intensity: 0.6 }],
  art: [{ key: 'art', intensity: 0.85 }, { key: 'museums', intensity: 0.7 }],
  architecture: [{ key: 'architecture', intensity: 0.85 }],
  archaeology: [{ key: 'archaeology', intensity: 0.85 }, { key: 'history', intensity: 0.75 }],
  city: [{ key: 'cities', intensity: 0.9 }],
  nightlife: [{ key: 'nightlife', intensity: 0.8 }, { key: 'bars', intensity: 0.7 }],
  music: [{ key: 'music', intensity: 0.8 }, { key: 'live-entertainment', intensity: 0.7 }],
  resort: [{ key: 'resorts', intensity: 0.9 }, { key: 'resort-stays', intensity: 0.85 }],
  'all-inclusive': [{ key: 'all-inclusive', intensity: 0.92 }, { key: 'relaxation', intensity: 0.7 }],
  luxury: [{ key: 'luxury', intensity: 0.8 }, { key: 'luxury-hotels', intensity: 0.75 }],
  budget: [{ key: 'budget-travel', intensity: 0.85 }, { key: 'luxury', intensity: 0.2 }],
  wellness: [{ key: 'wellness', intensity: 0.85 }, { key: 'spa', intensity: 0.7 }],
  yoga: [{ key: 'yoga', intensity: 0.85 }, { key: 'wellness', intensity: 0.75 }],
  surf: [{ key: 'surfing', intensity: 0.85 }, { key: 'water-sports', intensity: 0.7 }],
  sailing: [{ key: 'sailing', intensity: 0.8 }, { key: 'water-sports', intensity: 0.65 }],
  skiing: [{ key: 'skiing', intensity: 0.9 }, { key: 'snowboarding', intensity: 0.7 }, { key: 'mountains', intensity: 0.8 }],
  golf: [{ key: 'golf', intensity: 0.85 }],
  island: [{ key: 'beaches', intensity: 0.8 }, { key: 'swimming', intensity: 0.7 }],
  coast: [{ key: 'beaches', intensity: 0.7 }],
  countryside: [{ key: 'countryside', intensity: 0.85 }, { key: 'slow-travel', intensity: 0.65 }],
  walkable: [{ key: 'cities', intensity: 0.7 }, { key: 'local-culture', intensity: 0.65 }],
  slow: [{ key: 'slow-travel', intensity: 0.85 }, { key: 'fast-paced-travel', intensity: 0.2 }],
  romantic: [{ key: 'couples-travel', intensity: 0.8 }, { key: 'private-rooms', intensity: 0.6 }],
  photography: [{ key: 'photography', intensity: 0.8 }],
  temples: [{ key: 'religion-spirituality', intensity: 0.7 }, { key: 'history', intensity: 0.7 }],
  exotic: [{ key: 'spectrum-familiarity', intensity: 0.8 }],
  warm: [],
  cold: [],
  domestic: [],
  'road-trip': [{ key: 'road-trips', intensity: 0.85 }],
}
