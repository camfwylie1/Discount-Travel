# AI

What the AI does, what it is forbidden from doing, and what happens when there
is no AI at all.

Source: `src/lib/ai/`.

---

## The one rule

**The AI writes. It does not decide, and it does not know things.**

Ranking, matching, scoring and filtering are done by deterministic code that
can be tested and explained — see [RECOMMENDATIONS.md](RECOMMENDATIONS.md).
The AI's job is to turn facts the system already established into English a
person wants to read.

Concretely, the AI is never permitted to:

- rank or re-rank anything;
- produce, adjust or justify a match score;
- state a fact about a trip that is not in the deal record;
- infer anything about a member's gender, sexual orientation, ethnicity,
  religion, disability or health;
- decide whether someone is verified, blocked or suspended.

Where a fact is unknown, the product says **"Not specified"**. It does not fill
the gap, and it does not ask a model to fill the gap.

The reason is simple: a hallucinated match explanation is a lie told to a
member about their own preferences, and a hallucinated trip fact is a lie told
to someone about to spend thousands of dollars.

---

## What it is actually used for

| Capability | What it does | If it goes wrong |
| --- | --- | --- |
| `generateTravelerPersonality` | Writes the prose for a Travel DNA profile *whose archetype and radar were already computed* | Clumsy copy |
| `summariseDeal` | Rewrites a provider's description into a consistent house voice | Clumsy copy |
| `classifyDeal` | Suggests preference dimensions a trip relates to | Stored as `source: AI` at reduced weight, and reviewable |
| `generateMatchExplanation` | Phrases reasons the engine already produced | Clumsy copy |
| `moderateContent` | Flags user text for human review | A human still decides |
| `generateTravelBio` | Helps a member draft their own bio | They edit it |

Note the pattern. In every row, the decision was made before the model was
called, or a human makes it after. **The worst realistic outcome of the AI
failing completely is that the writing gets worse.**

`classifyDeal` is the only capability that touches data the engine consumes,
and its output is quarantined: stored with `source: AI`, weighted at 35% of a
stated fact, and visible for correction in `/admin/quality`.

Moderation is advisory only. A model has never suspended an account here.

---

## Three providers behind one interface

```ts
export interface AiProvider {
  readonly name: string
  readonly model: string | null
  readonly available: boolean
  generateTravelerPersonality(input): Promise<PersonalityOutput>
  summariseDeal(input): Promise<DealSummaryOutput>
  classifyDeal(input): Promise<DealClassificationOutput>
  generateMatchExplanation(input): Promise<MatchExplanationOutput>
  moderateContent(input): Promise<ModerationOutput>
  generateTravelBio(input): Promise<TravelBioOutput>
}
```

`AI_PROVIDER` selects one of `anthropic`, `openai` or `fallback`.

### The fallback is a real implementation

This is the part that matters most, and it is the easiest to get wrong.

`providers/fallback.ts` is **not a stub and not a placeholder.** It is a
complete deterministic implementation: real archetype selection by nearest
target profile, real sentence construction from the member's actual radar
values, real dimension classification from keyword and destination rules.

With `AI_PROVIDER=fallback` and no API key of any kind, the whole product
works. You can take the quiz, get a named Travel DNA profile with copy that
matches your answers, browse a ranked feed with explanations, and match with
other travellers.

That means three things worth stating separately:

1. **A demo needs no AI account.** Nothing is faked to achieve that.
2. **An outage degrades the writing, not the product.** If a provider call
   fails, the fallback answers and the result is marked `usedFallback`.
3. **Nothing is invented even in the fallback**, because templates can only
   restate values they are given.

The fallback has its own test suite, including a test named for the bug where
an outdoorsy, quiet traveller was labelled "The Social Adventurer" and told
they would enjoy a bar full of strangers.

---

## Caching, cost and provenance

Every generation is keyed by a **content hash of its input** and stored in
`AiGeneration` with the provider, the model, the token counts, the cost, the
latency and whether the fallback was used.

- The same deal is never summarised twice.
- Spend is attributable per capability, not just as one monthly total.
- A cache read or write failure never breaks the feature — it logs and
  continues.
- Because the provider and model are recorded against every generation, any
  sentence in the product can be traced back to what produced it.

### The monthly ceiling

`AI_MONTHLY_BUDGET_USD` is a hard ceiling, not a target. Once this calendar
month's recorded cost reaches it, `isOverBudget()` routes every capability to
the deterministic provider instead of calling a paid API. Nothing breaks; the
writing just gets plainer.

Two honest caveats:

- **The ceiling is measured in dollars, and dollars need prices.** Token counts
  are always recorded, but turning them into cost needs
  `AI_INPUT_USD_PER_MTOK` and `AI_OUTPUT_USD_PER_MTOK`, taken from the
  provider's current pricing page. Model prices change, and hardcoding them
  into a repository guarantees they are one day quietly wrong. Leave them unset
  and spend is recorded in tokens only — **with the dollar ceiling inactive.**
- **A failed budget read is treated as "not over budget".** Losing the copy
  across the whole product because one aggregate query timed out is the worse
  outcome. This is a cost control, not a safety control, and it is designed to
  fail in the direction of the product still working.

---

## Prompt discipline

Prompts live in one file, `prompts.ts`, so they can be reviewed in one place
and changed deliberately rather than drifting across the codebase. They are
built from structured input rather than string-concatenated from user text.
Every one of them:

- receives only the facts it is allowed to use;
- is told explicitly not to introduce facts;
- returns structured output that is schema-validated before use.

If a response fails validation, it is discarded and the fallback runs. A
malformed response never reaches a member.

Member-supplied text is data, never instruction. Nothing a member types into a
bio or a message can change what a prompt asks for.

---

## Honest reporting

`npm run verify` reports the AI as one of:

```
– AI copy    deterministic fallback — real templates, no model calls, nothing invented
✓ AI copy    anthropic key configured. Not called by this script.
✗ AI copy    AI_PROVIDER is "anthropic" but no API key is set — will fall back
```

Note the middle line. A configured key is reported as **configured**, never as
*working*, because this script has not called the API. An integration is only
described as working when it has actually been exercised.

Content produced by the fallback is marked as such in the admin, so nobody
mistakes template output for model output when judging quality.
