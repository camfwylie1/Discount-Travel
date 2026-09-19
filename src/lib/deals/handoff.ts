/**
 * OPENING A PROVIDER'S PAGE
 *
 * When a member decides to look at a trip, we hand them over to the company
 * that actually sells it. Voyaj never takes the booking. The question this
 * module answers is *how* that handoff happens.
 *
 * Showing the provider's own site inside our chrome keeps the member in the
 * app, which is what we want. It is also the thing we are least entitled to
 * do by default, for two independent reasons:
 *
 *   1. LEGAL. Framing another company's site puts their content inside our
 *      interface. Most terms of service prohibit it outright, and doing it
 *      uninvited weakens the position that matters most to this product —
 *      that Voyaj is a search service linking to third parties, with no part
 *      in the sale. A framed page looks like OUR page. That impression is
 *      exactly what creates liability for someone else's transaction.
 *
 *   2. TECHNICAL. It mostly does not work anyway. Travel sites are a prime
 *      clickjacking target, so nearly all of them send X-Frame-Options: DENY
 *      or a frame-ancestors CSP. A browser silently refuses, and the member
 *      gets a blank rectangle.
 *
 * So framing is opt-in per provider, recorded in their compliance record by a
 * person, exactly like every other permission. Where it is not granted, the
 * member still does not simply vanish into a new tab: they get a handoff that
 * Voyaj knows about and can pick back up when they return.
 */
export type OpenMode = 'IN_APP' | 'NEW_TAB'

export interface HandoffDecision {
  mode: OpenMode
  /** Why, in words an admin screen can show without further explanation. */
  reason: string
}

export interface FramingInput {
  providerName: string
  framingPermitted: boolean
  /** A provider we are not permitted to ingest from at all is not framed either. */
  complianceStatus: string
}

/**
 * Decides how a provider's page should be opened.
 *
 * Note what this does NOT do: it never guesses. If nobody has recorded that a
 * provider agreed to be framed, the answer is a new tab, even though framing
 * would keep the member in the app for longer. "They probably would not mind"
 * is not a permission.
 */
export function decideOpenMode(input: FramingInput): HandoffDecision {
  if (input.complianceStatus === 'BLOCKED') {
    return { mode: 'NEW_TAB', reason: `${input.providerName} is blocked.` }
  }

  if (!input.framingPermitted) {
    return {
      mode: 'NEW_TAB',
      reason:
        `${input.providerName} has not agreed to have their site shown inside Voyaj. ` +
        `Record the permission on their compliance page to change this.`,
    }
  }

  return {
    mode: 'IN_APP',
    reason: `${input.providerName} has agreed to in-app display.`,
  }
}

/**
 * The attribution a framed provider must carry.
 *
 * If we are going to show someone else's site inside our window, the member
 * has to be able to tell at a glance whose site they are looking at and who
 * they would be buying from. This is the sentence that makes the frame honest.
 */
export function framedAttribution(providerName: string): string {
  return `You are viewing ${providerName}. Any booking is made with them, not with Voyaj.`
}
