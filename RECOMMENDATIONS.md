# The recommendation engine

This is the product. Everything else is how members reach it.

It is **deterministic arithmetic**, not a model. The same member and the same
trip always produce the same score; every score carries the components that
built it; and every rule below is covered by unit tests that run in under a
second without a database.

Source: `src/lib/recommendations/`.

---

## Why not a language model

A model can rank things. It cannot tell you *why* it ranked something third,
cannot be regression-tested when it silently changes its mind, and cannot be
shown to a member as an explanation they can argue with.

Voyaj's core claim to a member is "here is why this trip is for you". That
claim has to be derived from the score, not written about it afterwards — and
that requires the score to have parts.

The AI has a real job here, and it is a different one: writing readable copy
from facts the engine already established. It never ranks and never invents.
See [AI.md](AI.md).

---

## 1. Affinity: what a 1–5 rating actually means

The single most important idea in the engine. A rating carries **both a
direction and an importance**:

```
affinity  a = (rating − 3) / 2     ∈ [−1, +1]
weight    w = |a|
```

| Rating | a | Meaning | Weight |
| --- | --- | --- | --- |
| 1 | −1.0 | actively avoid | 1.0 |
| 2 | −0.5 | would rather not | 0.5 |
| 3 | 0.0 | neutral | 0.0 — ignored entirely |
| 4 | +0.5 | important | 0.5 |
| 5 | +1.0 | extremely important | 1.0 |

A trip's intensity for a dimension is re-centred the same way so the two can be
multiplied directly:

```
signed intensity  t = (2x − 1) · confidence     ∈ [−1, +1]
```

where `x ∈ [0,1]` is how much of that thing the trip has, and `confidence` is
how sure we are it is true.

**One dimension contributes `a · t`**, which gives four behaviours,
symmetrically:

| Member | Trip | Contribution | |
| --- | --- | --- | --- |
| loves it (+1) | has it (+1) | **+1** | delight |
| loves it (+1) | lacks it (−1) | **−1** | disappointment |
| avoids it (−1) | lacks it (−1) | **+1** | **relief** |
| avoids it (−1) | has it (+1) | **−1** | aversion |

The third row is the one most recommenders get wrong. Someone who hates hiking
should be *actively pleased* by a trip with no hiking — and Voyaj tells them so:
*"Very little hiking — which suits you."*

A rating of 1 is a negative number. It is never merely the absence of a bonus.

---

## 2. The hard gate comes first

Before anything is scored, `checkHardConstraints()` asks whether the trip is
admissible at all. Hard constraints **exclude**; they do not subtract.

Checked: availability and expiry, maximum budget (scaled by party size),
departure airport, earliest and latest travel dates, and trip length.

A member who says "$3,000 is my absolute maximum" means it. If a violated
limit were merely a penalty, a sufficiently attractive $4,000 trip would climb
back over it — and the member's stated limit would turn out to be a suggestion.

Each failure carries a **label** and a **suggestion**, so a member who ends up
with nothing is told which of their own limits is responsible and what change
would open things up:

> *Costs more than your maximum budget. Raising your maximum budget to $3,205
> would include this trip.*

The figure is the trip's actual cost for that member's party size, so the
suggestion is always the smallest change that would work rather than a vague
"try widening your filters".

This is why the empty state can distinguish "your filters are narrow" from
"your own hard limits exclude everything" — a distinction most products never
make.

Failures are recorded (`hardFiltered`, `filterReason`) rather than thrown away.

---

## 3. The nine components

Trips that pass the gate are scored across nine weighted components:

| Component | Weight | What it measures |
| --- | --- | --- |
| Interests | 0.20 | Travel style, culture, food and drink |
| Budget | 0.17 | Fit against the *preferred* budget, not the maximum |
| Activities | 0.14 | What you actually do on the trip |
| Airport | 0.13 | Departure convenience, by the member's ranked airports |
| Style | 0.11 | The nine spectrum answers |
| Dates | 0.08 | Fit against when they can travel |
| Social | 0.06 | Group size, meeting people, nightlife |
| Duration | 0.06 | Trip length against preference |
| Accommodation | 0.05 | Where you sleep, and how comfortable |

Each returns a 0–1 score and a weight. The base score is the weighted mean.

Where there is no evidence for a component, it is not scored as zero — that
would punish a trip for our ignorance. Its weight is reduced (to 25% of
nominal) and it is labelled *"Not enough information to judge"*.

Attributes the engine inferred rather than read are down-weighted by
`MISSING_ATTRIBUTE_WEIGHT_FACTOR = 0.35`. A guess should not carry the same
force as a stated fact.

---

## 4. The aversion penalty

A weighted mean has a real failure mode, and it showed up in testing.

A member who loves hiking and hates nightlife was shown a party trip only
**seven points** below a quiet one. The party trip won on interests, budget,
airport and dates; the single thing they had explicitly said they did not want
was diluted to almost nothing by eight components that did not care.

That is the wrong answer, and averaging produced it. So a strongly-held
aversion, violated, is penalised on top of the mean:

```ts
const AVERSION_THRESHOLD           = -0.5   // rating 1 or 2
const AVERSION_PENALTY_PER_VIOLATION = 0.14
const MAX_AVERSION_PENALTY         = 0.28   // never more than two violations' worth

if (affinity <= AVERSION_THRESHOLD && signed > 0) {
  aversionViolation += Math.abs(affinity) * signed
}

const aversionPenalty = Math.min(MAX_AVERSION_PENALTY,
                                 aversionViolation * AVERSION_PENALTY_PER_VIOLATION)
const score = clamp01(base + wishlistBonus − aversionPenalty)
```

A violated aversion is also always marked **notable**, so it appears in the
mismatches whatever else the trip has going for it. The member sees the reason
they will not enjoy it, not just a slightly lower number.

The penalty is capped. Three things you dislike is bad; it is not a reason to
drive the score to zero and lose all ordering among bad options.

---

## 5. Deal value is a separate question

`dealValue.ts` never touches the match score, and the two are never combined.

**"Is this a good price?" and "is this trip for me?" are different questions.**
A cheap trip you would hate and a perfect trip at full price are both bad
recommendations, for opposite reasons, and one blended number hides which.

Value is judged from the provider's own price history and comparable trips —
not from a displayed discount. A "was $4,000, now $2,000" banner is a marketing
claim, not evidence.

Two rules make this honest:

- **Unverified discounts are halved, at a fixed weight.** An unverified claim
  contributes at half score with its weight pinned at `0.3`. An earlier version
  halved both the score *and* the weight, which cancelled out: a verified and
  an unverified discount both scored 78. Verification has to be monotonic —
  checking a claim can only ever raise confidence in it.
- **Thin evidence returns no score at all.** Fewer than two components, or a
  total weight below `0.3`, returns `score: null` and `band: 'unknown'`. The UI
  says it does not know. It does not average two weak signals into a confident
  "Great value".

Bands: `exceptional` ≥ 82, `great` ≥ 68, `good` ≥ 50, then `fair`.

---

## 6. Travel DNA

Radar axes (outdoors, culture, nightlife, luxury, adventure, activity,
spontaneity, food and so on) are built from the member's own answers, weighted
by how much each dimension matters to that axis.

Sparse answers are the danger. Someone who has rated two things should not be
handed a confident extreme, so each axis is pulled towards neutral by an
empirical-Bayes-style prior:

```ts
export const PRIOR_WEIGHT = 2.2
const NEUTRAL = 0.5
const shrunk = (entry.sum + NEUTRAL * PRIOR_WEIGHT) / (entry.weight + PRIOR_WEIGHT)
```

A well-answered axis barely moves. A one-answer axis is pulled most of the way
back to the middle. Confidence is earned.

### Choosing an archetype

The member's radar is compared against each archetype's **target profile** by
mean squared distance, and the nearest wins. If nothing is within range
(`bestDistance > 1200`), they get "The All-Rounder" rather than a forced label.

This replaced a "high axes minus low axes" heuristic that produced a genuine
bug: an outdoorsy, quiet traveller was named **"The Social Adventurer"** and
told they would love *"a bar full of new people"* — at a nightlife score of 24.
The copy contradicted their own answers.

Nearest-profile matching makes that structurally impossible: an archetype can
only be chosen if the member's radar actually resembles it, so its description
cannot contradict the numbers it was chosen by. There is a test named for that
exact bug.

---

## 7. Traveller and group matching

Traveller compatibility is a **separate engine** (`travelerScore.ts`), because
"would I enjoy this trip?" and "would I enjoy this trip *with you*?" are
different questions.

It is symmetric: the order of the two people never changes the score, and there
is a test that says so.

Where two people disagree on a spectrum, the conflict is described in the
dimension's own words rather than merely named:

> *Pace: one of you leans relaxed, the other packed itinerary*

"Pace" alone tells nobody anything. The wording is ordered by the spectrum's
poles rather than by which person was passed first, so one fact reads the same
way to both of them.

### Group recommendations surface disagreement

A group score **leads with the minimum**, not the mean. A trip that four people
love and one person would hate is not a good group trip, and an average says it
is.

```ts
export const DISAGREEMENT_MIN_CONFIDENCE = 0.6
export const MAX_DISAGREEMENTS = 5
```

Disagreements name actual people:

> *Marc and Jordan would rather avoid hiking, and this trip is built around it.*

The confidence floor matters more than it looks. Voyaj will **not name a person
as unhappy with a trip on the strength of its own inference.** A disagreement
is only surfaced when it rests on what that member actually told us. Being told
your friend will hate something, on a guess, is worse than saying nothing.

---

## 8. Explanations

`explain.ts` turns components into sentences. It reads the *same structure*
that produced the score, so the explanation and the number cannot drift apart.

Reasons are ranked by contribution, so a member sees the things that actually
moved their score — including the negative ones. Mismatches are never hidden;
a recommendation that only lists upsides is an advertisement.

---

## 9. What is tested

Unit tests cover, among others:

- Every affinity case, including relief and aversion.
- The aversion penalty, with the party-trip scenario that motivated it.
- Verified vs unverified discounts scoring monotonically.
- Value returning `null` rather than guessing on thin evidence.
- Hard constraints excluding rather than penalising, with the suggestion text.
- Radar shrinkage on sparse answers.
- Archetype selection, including the "Social Adventurer" bug by name.
- Group scoring leading with the minimum and naming disagreements.
- Symmetry of traveller matching and of disagreement wording.

```bash
npm test          # 266 unit and integration tests
```

---

## Known limitations

Stated plainly, because a recommendation engine that hides its edges is not
trustworthy:

- **Single currency.** Budget constraints compare prices in their own currency.
  Correct for a CAD-only launch catalogue; wrong for a mixed one. Converting
  needs a rate source and a decision about which rate applies when.
- **No collaborative signal yet.** Scoring is entirely content-based. Clicks,
  saves and ranked position are now recorded (`RecommendationEvent.position`),
  which is the raw material for learning weights from behaviour — but nothing
  learns from them today.
- **Weights are hand-set.** The nine component weights are a considered guess,
  not a fitted model. They are in one exported constant so they can be changed,
  measured and defended.
- **Deal attributes are only as good as the supply.** Where a provider does not
  state something, the engine is working from an inference at 35% weight, or
  from nothing at all. Better supply is worth more than a better algorithm.
