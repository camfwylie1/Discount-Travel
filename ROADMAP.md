# Roadmap

What exists, what is missing, and the order it should be built in.

The first section is the most useful one: it is a list of things this product
cannot currently do. A roadmap that only lists ambitions is a sales document.

---

## Known gaps, today

### Blocking a real launch

| Gap | Why it blocks | Effort |
| --- | --- | --- |
| **No provider agreements** | The pipeline refuses to ingest without one, so there is no live inventory. This is commercial work, not engineering. | Business development |
| ~~Rate limiting is in-memory~~ | **Fixed.** Sign-in, sign-up, reset and checkout are now counted in Postgres, so the limit means the same thing on every instance. High-volume buckets stay in memory deliberately. | Done |
| **Legal review not done** | Privacy, subscription, all-in pricing and travel registration. See [SECURITY.md](SECURITY.md#legal-matters-requiring-professional-review). | External |
| **No production email domain** | Verification and reset go to the terminal until a provider is configured. | Small |

### Real, but smaller

| Gap | Consequence |
| --- | --- |
| Single currency in budget comparisons | A 3,000 USD trip reads as inside a 3,500 CAD limit. Correct for a CAD-only catalogue, wrong for a mixed one. Needs a rate source and a decision about which rate applies when — a business choice before a technical one. |
| The in-app viewer needs provider agreement | Most travel sites refuse framing, so for most providers the page opens in a tab. This is a commercial gap, not a technical one, and the fallback is handled. |
| Apple Pay unexercised | The wallet sheet needs a Stripe account, a verified domain and a real device. The code path and the webhook that grants access are both tested; the sheet itself is not. |
| ~~No explicit CSRF token~~ | **Fixed.** State-changing requests are origin-checked in the wrapper every route already goes through, so a new route is protected by existing. |
| Component weights are hand-set | Nine considered guesses, not a fitted model. |
| No collaborative filtering | Scoring is entirely content-based. Position, clicks and saves are now recorded, but nothing learns from them. |
| Messaging polls | No websockets. Fine at current scale, visibly not fine later. |
| No image CDN | Photos are served directly. |
| Admin has no bulk editing | Every correction is one at a time. |
| No dependency scanning in CI | |
| No penetration test | Reviewed by its authors, which is not the same thing. |
| English only | Québec has French requirements for commercial content. |
| Deal photography is stock | Real inventory brings provider photography and its own licensing conditions. |

---

## Phase 1 — Make it launchable (weeks 1–8)

Nothing in this phase is a new feature. It is the work between "it runs" and
"it can take a stranger's money".

1. **Sign two or three providers.** Affiliate networks or direct partners who
   want the referral traffic. Everything needed to switch one on already
   exists; the work is the agreement.
2. ~~Move rate limiting to Redis.~~ **Done, without Redis.** The
   security-critical buckets are counted in Postgres, which every instance
   already shares, and the live update bus rides the same database through
   LISTEN/NOTIFY. Neither needed new infrastructure, and both are covered by
   integration tests that publish from a second connection.
3. **Legal review.** Privacy (PIPEDA, Law 25), subscription and auto-renewal
   rules, all-in pricing, provincial travel registration. Rewrite the policy
   drafts with counsel.
4. **Production email**, with a verified sending domain and DMARC.
5. **Ingest for real, and watch it.** The first live import will find bugs the
   test fixtures did not. Alert on zero-row runs and on anything not
   re-checked in 72 hours.
6. **All-in pricing per provider.** Establish what each provider's quoted price
   includes before it is displayed. This is a regulatory requirement, not a
   nicety, and it is the largest exposure in the product.
7. **Security contact and response process.**

## Phase 2 — Make it good (months 3–6)

8. **Learn the weights.** Position-aware click and save data exists from day
   one; fit the nine component weights against it instead of defending a guess.
   Hold out a control group so the improvement is measurable rather than
   assumed.
9. **Price-drop alerts.** `DealPriceHistory` is already collected. "The trip you
   saved dropped $340" is the highest-value notification this product can send,
   and the data for it is sitting there.
10. **Multi-currency.** A rate source, a decision about which rate applies when,
    and comparisons done in one currency.
11. **Real-time messaging.** Websockets, replacing polling.
12. **Mobile web polish.** The phone suite passes; there is a difference
    between passing and pleasant.
13. **Trip planning depth.** Itinerary building, shared documents, cost
    splitting.
14. **French.** Required for Québec, and Montréal is one of the nine gateways.

## Phase 3 — Make it defensible (months 6–12)

15. **Collaborative signal.** "Travellers with your DNA also loved…", built on
    top of the deterministic engine rather than replacing it. The explanation
    must survive: a recommendation nobody can interrogate is a step backwards
    however accurate it is.
16. **Verification that means something.** Government ID through a third-party
    provider, for members who want it. Only ever described as what it actually
    verified.
17. **Native apps.** Push notification is the right channel for a price drop.
18. **Provider self-service.** Let providers list directly, which turns supply
    from a cost into a channel.
19. **Second market.** The architecture is market-agnostic; the work is
    gateways, currency, seasonality and local compliance. The United States is
    the obvious next step and brings a different regulatory profile.

---

## Deliberately not planned

Worth stating, because each is a thing investors ask for.

- **Scraping.** Publicly visible is not licensed. The compliance gate exists to
  stop this, and removing it would be removing the product's main claim to
  being a trustworthy partner.
- **An LLM as the recommendation engine.** It cannot explain itself, cannot be
  regression-tested, and cannot be shown to a member as a reason. See
  [RECOMMENDATIONS.md](RECOMMENDATIONS.md#why-not-a-language-model).
- **Inferring sensitive characteristics to improve matching.** It would improve
  the numbers. It is not going to happen.
- **Becoming the merchant of record for travel.** Taking payment for travel
  brings provincial registration, bonding and consumer-protection obligations
  that change the business entirely. Referral is the model.
- **Dark-pattern retention.** Cancellation stays one click in the Stripe
  portal. A membership people cannot leave is a membership people will not
  join.

---

## How to tell if it is working

Vanity metrics are easy here — trips listed, accounts created. These are the
ones that actually indicate the product works:

| Metric | Why it is the right one |
| --- | --- |
| Quiz completion rate | Twelve steps is a lot to ask before any value is delivered. |
| Outbound click-through **by ranked position** | If position 1 does not beat position 10, the ranking is not working. Now measurable. |
| Free → paid conversion | Whether the Travel DNA is worth $99. |
| Renewal at twelve months | The only honest measure of whether a trip was actually taken and enjoyed. |
| Group trips reaching a decision | The social product's real test is not messages sent. |
| Proportion of members with 3+ connections | The flywheel, or the absence of one. |
| Stale-deal rate | Trust. A stale price shown as current costs more than a slow week. |

---

## The honest summary

The engineering is ahead of the business. The engine is built, tested and
explainable; the social layer works; payments are real; the compliance gate
does its job, including by refusing.

What is missing is **supply and paperwork** — provider agreements and a lawyer.
Both are solvable with money and time rather than with more code, which is a
better position to be in than the reverse.
