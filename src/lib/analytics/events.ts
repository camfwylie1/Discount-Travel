import 'server-only'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/observability/logger'

/**
 * ANALYTICS
 *
 * Every product event is written to our own database first, so the funnel
 * belongs to the company rather than to a vendor. A second sink (PostHog or
 * equivalent) can be added without changing any call site.
 *
 * We deliberately do not record anything sensitive: no exact location, no
 * message content, no inferred characteristics.
 */

export type EventName =
  | 'landing_viewed' | 'signup_started' | 'signup_completed' | 'login' | 'email_verified'
  | 'quiz_started' | 'quiz_step_completed' | 'quiz_completed'
  | 'personality_generated' | 'personality_regenerated'
  | 'feed_viewed' | 'deal_impression' | 'deal_opened' | 'deal_saved' | 'deal_unsaved'
  | 'deal_shared' | 'deal_hidden' | 'outbound_click' | 'search_performed' | 'filters_applied'
  | 'discovery_mode_used' | 'match_explanation_expanded' | 'recommendation_feedback'
  // Self-reported only. Never written from behaviour.
  | 'handoff_outcome' | 'provider_viewed_in_app'
  | 'people_viewed' | 'profile_viewed' | 'connection_requested' | 'connection_accepted'
  | 'circle_created' | 'trip_created' | 'trip_joined' | 'message_sent'
  | 'paywall_viewed' | 'checkout_started' | 'subscription_activated' | 'subscription_cancelled'
  | 'user_blocked' | 'user_reported' | 'profile_photo_uploaded' | 'account_deleted'

export interface TrackOptions {
  userId?: string | null
  anonymousId?: string | null
  properties?: Record<string, unknown>
  path?: string
}

export async function track(name: EventName, options: TrackOptions = {}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name,
        userId: options.userId ?? null,
        anonymousId: options.anonymousId ?? null,
        properties: (options.properties ?? {}) as object,
        path: options.path ?? null,
      },
    })
  } catch (error) {
    // Analytics must never break a user action.
    logger.warn('analytics.write_failed', { name, error: String(error) })
  }
}

/** Recommendation-specific feedback loop, kept separate from product analytics. */
export async function trackRecommendation(
  userId: string,
  type:
    | 'IMPRESSION' | 'CLICK' | 'SAVE' | 'SHARE' | 'HIDE' | 'VIEW_PROVIDER'
    | 'INVITE_FRIEND' | 'JOIN_TRIP' | 'NOT_INTERESTED' | 'FEEDBACK_YES' | 'FEEDBACK_NO',
  options: { dealId?: string; placement?: string; position?: number; score?: number; context?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await prisma.recommendationEvent.create({
      data: {
        userId,
        dealId: options.dealId ?? null,
        type,
        placement: options.placement ?? null,
        position: options.position ?? null,
        score: options.score ?? null,
        context: (options.context ?? {}) as object,
      },
    })
  } catch (error) {
    logger.warn('recommendation_event.write_failed', { type, error: String(error) })
  }
}

/** Batch impressions — the feed reports many at once rather than one per card. */
export async function trackImpressions(
  userId: string,
  items: { dealId: string; position: number; score?: number }[],
  placement: string,
): Promise<void> {
  if (items.length === 0) return
  try {
    await prisma.recommendationEvent.createMany({
      data: items.slice(0, 60).map((item) => ({
        userId,
        dealId: item.dealId,
        type: 'IMPRESSION' as const,
        placement,
        position: item.position,
        score: item.score ?? null,
      })),
    })
  } catch (error) {
    logger.warn('impressions.write_failed', { error: String(error) })
  }
}

export async function audit(params: {
  actorId?: string | null
  actorEmail?: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  ipHash?: string | null
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        before: (params.before ?? null) as object,
        after: (params.after ?? null) as object,
        ipHash: params.ipHash ?? null,
      },
    })
  } catch (error) {
    logger.error('audit.write_failed', { action: params.action, error: String(error) })
  }
}
