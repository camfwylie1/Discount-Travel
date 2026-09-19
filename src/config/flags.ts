/**
 * FEATURE FLAGS
 * Environment variables are the default. An administrator can override any
 * flag at runtime through the admin portal (stored in the AppSetting table),
 * which is read by `getRuntimeFlags()` on the server.
 */
const bool = (v: string | undefined, fallback = false) =>
  v === undefined || v === '' ? fallback : v === 'true' || v === '1'

export const flagDefaults = {
  SOCIAL_ENABLED: bool(process.env.FEATURE_SOCIAL_ENABLED, true),
  AI_ENABLED: bool(process.env.FEATURE_AI_ENABLED, true),
  PAYWALL_ENABLED: bool(process.env.FEATURE_PAYWALL_ENABLED, true),
  MAP_ENABLED: bool(process.env.FEATURE_MAP_ENABLED, false),
  AFFILIATE_TRACKING_ENABLED: bool(process.env.FEATURE_AFFILIATE_TRACKING_ENABLED, true),
  REFERRALS_ENABLED: bool(process.env.FEATURE_REFERRALS_ENABLED, false),
  GROUP_TRIPS_ENABLED: bool(process.env.FEATURE_GROUP_TRIPS_ENABLED, true),
} as const

export type FlagName = keyof typeof flagDefaults
export type Flags = Record<FlagName, boolean>

/**
 * PAYWALL CONFIGURATION
 * Which surfaces require a paid membership. Deliberately data, not code, so
 * the conversion funnel can be tuned without a deploy.
 */
export const paywall = {
  /** Free, always: the quiz and the personality reveal are the hook. */
  free: ['landing', 'quiz', 'personality', 'profile', 'settings'] as const,
  /** Free but limited — the preview that sells the membership. */
  preview: {
    feedDeals: 6,
    searchResults: 6,
    peopleMatches: 3,
    showMatchScore: true,
    showFullExplanation: false,
    allowOutboundClick: false,
    allowSave: false,
    allowMessaging: false,
  },
  /** Surfaces that always require membership when PAYWALL_ENABLED. */
  gated: ['deal-outbound', 'messaging', 'trips', 'circles', 'unlimited-feed'] as const,
} as const
