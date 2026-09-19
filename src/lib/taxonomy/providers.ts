/**
 * DEMO PROVIDERS
 *
 * IMPORTANT — READ THIS BEFORE LAUNCH
 *
 * Every provider below is FICTIONAL. They exist so the marketplace has
 * realistic, varied inventory for development and for the investor
 * demonstration. They are all created with `isDemoContent = true` on their
 * deals, and the interface labels that content as demonstration inventory.
 *
 * We have deliberately NOT pre-populated real travel companies with claims
 * about their APIs, affiliate programmes or terms, because we have not
 * reviewed those terms and stating them would be inventing facts. Real
 * providers are added through the admin portal, and the ingestion pipeline
 * refuses to import from any provider whose compliance record does not
 * permit the method being used. See DATA_INGESTION.md § Provider onboarding.
 */

export interface ProviderSeed {
  slug: string
  name: string
  websiteUrl: string
  description: string
  tripTypes: string[]
  qualityScore: number
  compliance: {
    status: 'NOT_REVIEWED' | 'UNDER_REVIEW' | 'PERMITTED' | 'PERMITTED_WITH_CONDITIONS' | 'BLOCKED'
    hasPublicApi: boolean
    hasAffiliateProgram: boolean
    affiliateNetwork?: string
    commissionModel?: string
    structuredExtractionPermitted: boolean
    attributionRequired: boolean
    attributionText?: string
    imageUseRestricted: boolean
    maxCacheHours?: number
    allowedMethods: (
      | 'API'
      | 'AFFILIATE_FEED'
      | 'CSV_UPLOAD'
      | 'JSON_IMPORT'
      | 'XML_FEED'
      | 'MANUAL_ENTRY'
      | 'STRUCTURED_EXTRACTION'
    )[]
    updateFrequencyHours?: number
    notes?: string
    blockedReason?: string
  }
}

export const PROVIDER_SEEDS: ProviderSeed[] = [
  {
    slug: 'northbound-adventures',
    name: 'Northbound Adventures',
    websiteUrl: 'https://example.com/northbound',
    description:
      'Small-group active travel operator running hiking, cycling and multi-sport trips for Canadian departures.',
    tripTypes: ['adventure-tour', 'hiking-tour', 'cycling-tour', 'expedition'],
    qualityScore: 0.86,
    compliance: {
      status: 'PERMITTED',
      hasPublicApi: true,
      hasAffiliateProgram: true,
      affiliateNetwork: 'Direct',
      commissionModel: '8% of gross booking value, 60-day cookie',
      structuredExtractionPermitted: false,
      attributionRequired: true,
      attributionText: 'Trip operated by Northbound Adventures',
      imageUseRestricted: false,
      maxCacheHours: 24,
      allowedMethods: ['API', 'JSON_IMPORT', 'MANUAL_ENTRY'],
      updateFrequencyHours: 12,
      notes: 'Demonstration provider. Compliance terms are illustrative only.',
    },
  },
  {
    slug: 'maple-leaf-vacations',
    name: 'Maple Leaf Vacations',
    websiteUrl: 'https://example.com/mapleleaf',
    description:
      'Vacation package wholesaler specialising in Caribbean and Mexican all-inclusive resorts from Canadian gateways.',
    tripTypes: ['flight-hotel', 'all-inclusive', 'resort'],
    qualityScore: 0.74,
    compliance: {
      status: 'PERMITTED_WITH_CONDITIONS',
      hasPublicApi: false,
      hasAffiliateProgram: true,
      affiliateNetwork: 'Impact',
      commissionModel: '4% of package value, excludes taxes',
      structuredExtractionPermitted: false,
      attributionRequired: true,
      attributionText: 'Package sold and operated by Maple Leaf Vacations',
      imageUseRestricted: true,
      maxCacheHours: 6,
      allowedMethods: ['AFFILIATE_FEED', 'CSV_UPLOAD', 'MANUAL_ENTRY'],
      updateFrequencyHours: 6,
      notes:
        'Demonstration provider. Images may only be used on the deal detail page, not in advertising.',
    },
  },
  {
    slug: 'cedar-rail-journeys',
    name: 'Cedar & Rail Journeys',
    websiteUrl: 'https://example.com/cedarrail',
    description: 'Rail-based and slow-travel itineraries through Europe and Japan.',
    tripTypes: ['tour', 'cultural', 'city-break'],
    qualityScore: 0.81,
    compliance: {
      status: 'PERMITTED',
      hasPublicApi: false,
      hasAffiliateProgram: true,
      affiliateNetwork: 'Partnerize',
      commissionModel: '6% of land package',
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: false,
      maxCacheHours: 48,
      allowedMethods: ['XML_FEED', 'CSV_UPLOAD', 'MANUAL_ENTRY'],
      updateFrequencyHours: 24,
      notes: 'Demonstration provider.',
    },
  },
  {
    slug: 'harbour-crossing-cruises',
    name: 'Harbour Crossing Cruises',
    websiteUrl: 'https://example.com/harbourcrossing',
    description: 'Small-ship expedition and coastal cruising, including Atlantic Canada.',
    tripTypes: ['cruise', 'expedition'],
    qualityScore: 0.79,
    compliance: {
      status: 'PERMITTED',
      hasPublicApi: true,
      hasAffiliateProgram: true,
      commissionModel: '10% of cabin fare',
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: false,
      maxCacheHours: 24,
      allowedMethods: ['API', 'JSON_IMPORT', 'MANUAL_ENTRY'],
      updateFrequencyHours: 12,
      notes: 'Demonstration provider.',
    },
  },
  {
    slug: 'terra-vine-collective',
    name: 'Terra & Vine Collective',
    websiteUrl: 'https://example.com/terravine',
    description: 'Food and wine travel specialists across Europe, South America and South Africa.',
    tripTypes: ['food-wine', 'cultural', 'tour'],
    qualityScore: 0.88,
    compliance: {
      status: 'PERMITTED',
      hasPublicApi: false,
      hasAffiliateProgram: true,
      commissionModel: '9% of tour price',
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: false,
      maxCacheHours: 72,
      allowedMethods: ['CSV_UPLOAD', 'JSON_IMPORT', 'MANUAL_ENTRY'],
      updateFrequencyHours: 48,
      notes: 'Demonstration provider.',
    },
  },
  {
    slug: 'summit-line-ski',
    name: 'Summit Line Ski',
    websiteUrl: 'https://example.com/summitline',
    description: 'Ski and snowboard packages to the Alps, Japan and western Canada.',
    tripTypes: ['ski', 'flight-hotel', 'resort'],
    qualityScore: 0.77,
    compliance: {
      status: 'PERMITTED_WITH_CONDITIONS',
      hasPublicApi: false,
      hasAffiliateProgram: false,
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: true,
      maxCacheHours: 12,
      allowedMethods: ['CSV_UPLOAD', 'MANUAL_ENTRY'],
      updateFrequencyHours: 24,
      notes:
        'Demonstration provider. No affiliate programme — outbound clicks are tracked but not monetised.',
    },
  },
  {
    slug: 'still-water-retreats',
    name: 'Still Water Retreats',
    websiteUrl: 'https://example.com/stillwater',
    description: 'Wellness, yoga and spa retreats in warm-weather destinations.',
    tripTypes: ['wellness', 'resort'],
    qualityScore: 0.83,
    compliance: {
      status: 'PERMITTED',
      hasPublicApi: false,
      hasAffiliateProgram: true,
      commissionModel: '12% of retreat price',
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: false,
      maxCacheHours: 72,
      allowedMethods: ['CSV_UPLOAD', 'JSON_IMPORT', 'MANUAL_ENTRY'],
      updateFrequencyHours: 72,
      notes: 'Demonstration provider.',
    },
  },
  {
    slug: 'wander-collective',
    name: 'The Wander Collective',
    websiteUrl: 'https://example.com/wander',
    description:
      'Social small-group trips aimed at solo travellers in their twenties and thirties.',
    tripTypes: ['group-travel', 'solo-friendly', 'adventure-tour'],
    qualityScore: 0.8,
    compliance: {
      status: 'PERMITTED',
      hasPublicApi: true,
      hasAffiliateProgram: true,
      commissionModel: '7% of trip price',
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: false,
      maxCacheHours: 24,
      allowedMethods: ['API', 'JSON_IMPORT', 'CSV_UPLOAD', 'MANUAL_ENTRY'],
      updateFrequencyHours: 12,
      notes: 'Demonstration provider.',
    },
  },
  {
    slug: 'atlas-flash',
    name: 'Atlas Flash',
    websiteUrl: 'https://example.com/atlasflash',
    description: 'Flash-sale travel site with short-lived, heavily discounted packages.',
    tripTypes: ['flight-hotel', 'city-break', 'all-inclusive'],
    qualityScore: 0.61,
    compliance: {
      status: 'UNDER_REVIEW',
      hasPublicApi: false,
      hasAffiliateProgram: true,
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: true,
      maxCacheHours: 2,
      allowedMethods: ['MANUAL_ENTRY'],
      updateFrequencyHours: 2,
      notes:
        'Demonstration provider. Terms not yet reviewed, so only manual entry is permitted and offers expire quickly.',
    },
  },
  {
    slug: 'trailhead-domestic',
    name: 'Trailhead Canada',
    websiteUrl: 'https://example.com/trailhead',
    description: 'Domestic Canadian outdoor trips — Rockies, Atlantic Canada and the North.',
    tripTypes: ['road-trip', 'hiking-tour', 'adventure-tour'],
    qualityScore: 0.84,
    compliance: {
      status: 'PERMITTED',
      hasPublicApi: false,
      hasAffiliateProgram: false,
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: false,
      maxCacheHours: 48,
      allowedMethods: ['CSV_UPLOAD', 'MANUAL_ENTRY'],
      updateFrequencyHours: 48,
      notes: 'Demonstration provider.',
    },
  },
  {
    slug: 'gate-seven-city-breaks',
    name: 'Gate Seven City Breaks',
    websiteUrl: 'https://example.com/gateseven',
    description: 'Short European and North American city breaks, flight plus hotel.',
    tripTypes: ['city-break', 'flight-hotel'],
    qualityScore: 0.7,
    compliance: {
      status: 'PERMITTED_WITH_CONDITIONS',
      hasPublicApi: true,
      hasAffiliateProgram: true,
      commissionModel: '3.5% of package value',
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: true,
      maxCacheHours: 4,
      allowedMethods: ['API', 'JSON_IMPORT', 'MANUAL_ENTRY'],
      updateFrequencyHours: 4,
      notes: 'Demonstration provider. Prices change frequently; short cache required.',
    },
  },
  {
    slug: 'meridian-safari-co',
    name: 'Meridian Safari Co.',
    websiteUrl: 'https://example.com/meridian',
    description: 'Wildlife and safari specialists in eastern and southern Africa.',
    tripTypes: ['adventure-tour', 'expedition', 'tour'],
    qualityScore: 0.9,
    compliance: {
      status: 'PERMITTED',
      hasPublicApi: false,
      hasAffiliateProgram: true,
      commissionModel: '11% of land package',
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: false,
      maxCacheHours: 96,
      allowedMethods: ['CSV_UPLOAD', 'JSON_IMPORT', 'MANUAL_ENTRY'],
      updateFrequencyHours: 72,
      notes: 'Demonstration provider.',
    },
  },
  {
    slug: 'blocked-example-operator',
    name: 'Coastline Tours (example, blocked)',
    websiteUrl: 'https://example.com/coastline',
    description:
      'Included to demonstrate the compliance gate: this provider is blocked and the ingestion pipeline refuses to import from it.',
    tripTypes: ['tour'],
    qualityScore: 0.5,
    compliance: {
      status: 'BLOCKED',
      hasPublicApi: false,
      hasAffiliateProgram: false,
      structuredExtractionPermitted: false,
      attributionRequired: true,
      imageUseRestricted: true,
      allowedMethods: [],
      blockedReason:
        'Terms of service prohibit automated collection and republication of listing content. Do not ingest until written permission is obtained.',
      notes: 'Demonstration provider used to prove the compliance gate works.',
    },
  },
]
