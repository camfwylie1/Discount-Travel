# Investor demo

A fifteen-minute walkthrough that shows the product doing the thing that is
hard, rather than the thing that is pretty.

---

## Before they arrive

```bash
npm run setup && npm run seed && npm run dev
```

Open **http://localhost:3000**. Sign in as `demo@voyaj.test` /
`VoyajDemo!2025` — this is Cameron, who hikes, eats well and drinks wine.

Have a second browser window in private mode, ready for the signup flow.

Run `npm run verify` once beforehand so you know exactly what is configured. If
Stripe is not set up, say so at the start rather than being caught by it.

**Re-check the numbers below before the meeting.** They are what the current
seed produces, and any change to the seed or the engine moves them:

```bash
npx tsx scripts/engine-smoke.ts    # every persona's best and worst matches
```

Quoting a percentage that is no longer on the screen is the one avoidable way
to lose the room.

### Say this in the first thirty seconds

> *The trips in here are demonstration data, not live inventory. The matching,
> the accounts, the payments and the database are all real. I will point out
> which is which as we go.*

Saying it up front costs you nothing and buys you every claim you make
afterwards. Being caught not saying it costs you the room.

---

## The line the whole demo hangs on

> **Every travel site asks "where do you want to go?". We ask who you'd go
> with — and then go and find the trip.**

Voyaj is a social network for travellers with a search engine attached, in that
order. Say that order out loud, because the whole demo depends on it and the
navigation bar now reflects it.

Everything below is evidence for that sentence.

---

## 1 · The problem (1 min)

Open the landing page and stay on it for a moment.

> *Someone who has three thousand dollars and two weeks off does not have a
> destination problem. They have a decision problem. Every site they visit
> assumes they already know the answer and just want it cheaper.*

---

## 2 · The quiz (3 min) — private window

Sign up as a new person and answer as an **outdoorsy introvert**: sunrise hike,
a tent somewhere quiet, in bed early, trekking in Patagonia, a few friends,
guided experiences.

Then the Travel DNA screen.

> *No destination has been mentioned yet. This is built entirely from how they
> said they like to travel.*

**Point at the archetype name.** It is not decoration:

> *The name is chosen by finding the archetype whose profile is mathematically
> closest to theirs. An earlier version of this used a simpler heuristic and
> called this exact person "The Social Adventurer" — told an introvert they
> would love a bar full of strangers. We found it, fixed it, and there is a
> test named after that bug so it cannot come back.*

That story is worth more than the feature. It tells them the team finds its own
mistakes.

---

## 3 · Explanation, not ranking (4 min) — back to Cameron

Open the feed, then any trip.

Show the **match score** and the reasons underneath it.

> *Every score carries the reasons that produced it. This is arithmetic, not a
> language model. The same person and the same trip always give the same
> number, we can tell you which component moved it, and every rule is
> unit-tested.*

Then scroll to the **mismatches**.

> *We show what is wrong with it too. A recommendation that only lists upsides
> is an advertisement.*

### The best thirty seconds in the demo

Open Jordan's profile — *"Beaches, music and absolutely no hiking"*. Punta Cana
scores **90%**; the Riviera Maya all-inclusive scores **89%** and lists
**"Very little hiking"** among the reasons it *suits* them. Then show Banff at
**23%**.

> *Most engines treat a dislike as the absence of a bonus. Ours treats it as a
> negative number. If you have told us you hate hiking, a trip with no hiking
> should actively please you — and we say so in those words.*

### Then the two scores

> *Match and value are deliberately separate. A cheap trip you would hate and a
> perfect trip at full price are both bad recommendations, for opposite
> reasons, and one blended number hides which. We also refuse to score value at
> all when the evidence is thin — it says "not enough information" rather than
> inventing a confident "Great value".*

---

## 4 · The gate (1 min)

In settings, show Cameron's hard budget ceiling of **$5,500**. Point out that
the Tanzania safari — around **$7,200** — is absent from the feed. Twelve of
the 223 trips are excluded for him this way.

> *A hard limit excludes. It does not reduce a score. Someone who says three
> thousand is their maximum means it — and if a limit were just a penalty, a
> sufficiently attractive four-thousand-dollar trip would climb back over it.*

Then narrow the filters until the feed empties.

> *And when nothing matches, we say which of their own limits is responsible
> and exactly what change would open it up. Most products show a shrug.*

---

## 5 · People and groups (3 min)

Open **People**. Show a compatibility score with *"You both love"* and *"Where
you differ"*.

> *Computed from travel characteristics only — pace, budget, interests, trip
> length, availability. We never infer gender, sexuality, ethnicity, religion
> or health, from a name, a photo, behaviour or a model. Community features
> like women-only travel are opt-in settings, never a group we put someone in.*

Now open the **Costa Rica — February** trip, with nine members, and scroll to
*"How this trip suits the group"*.

> *This is the part nobody else does.*

The page leads with **31% — least happy member**, and shows the group average
of **55%** second and smaller. Its own words:

> *"We lead with whoever fits it least — averaging that away would not help
> anyone."*

Underneath, it names them and says why:

> *Some members cannot take this trip within their own limits.*
> *Jordan — 31% — Costs more than your maximum budget.*
> *Tomás — 34% — Costs more than your maximum budget.*
> *Amelia — 44% — Costs more than your maximum budget.*

> *Four people loving a trip and one unable to afford it is not a good group
> trip, and an average says it is. Three of these nine cannot take this trip
> within limits they set themselves — the organiser now knows that before
> booking rather than after. And we only name someone when it rests on what
> they actually told us, never on our own inference. Being told your friend
> will hate something, on a guess, is worse than saying nothing.*

---

## 6 · The business (2 min)

Cameron already has a membership, so `/upgrade` will send you to
`/settings/membership`. **Show that first** — it is the better slide:

> *Demonstration membership. This membership was created by the seed script
> for the investor demo. There is no Stripe subscription behind it and nothing
> has been charged.*

> *That is the product telling on itself, in the place where it would be
> easiest to let you assume otherwise.*

Then use the private window — the account you made in step 2, once its quiz is
finished — to see the real paywall at `/upgrade`.

> *$99 Canadian a year. The quiz and the Travel DNA are free, because the
> personality profile is what makes someone come back. The marketplace, the
> explanations, saving and messaging are the membership.*

If Stripe keys are configured, run a test checkout with `4242 4242 4242 4242`.
If they are not, the page says **"This installation does not have Stripe keys
configured, so checkout is unavailable"** — point at it rather than talking
around it:

> *No fake success screen. If payments are not wired up, it says so.*

Either way, make the architectural point:

> *Membership is granted by the signed webhook, never by the redirect. The
> redirect URL is something a user can type; the webhook is not. Fourteen
> integration tests cover that path, including Stripe retrying the same event.*

Second revenue line, briefly:

> *Affiliate commission on outbound clicks, with the relationship disclosed.
> Sponsored placement is a separate, labelled surface and can never touch a
> compatibility score — there is nowhere in the scoring code for a sponsorship
> to enter.*

---

## 6b · The two things people ask to see (2 min)

**Open a trip and press "View on …".** The provider's own page opens inside
Voyaj, with their name and real domain across the top and a line saying the
booking is with them.

> *People do not come back to a tab they left. So the provider's page opens in
> here. Note the bar — we always say whose site you are on, because we are a
> search service and a frame that hid that would make us look like the seller.*
>
> *And this is opt-in per provider. Most travel sites refuse to be embedded at
> all, so for them it opens in a tab — and even then we hold the thread and ask
> what happened when you come back. We never assume you booked because you
> clicked.*

**Then point at the price.** There is a live indicator under it.

> *That is a live connection. When a provider posts a change, the price
> corrects itself on screen and says that it moved. A stale price shown as
> current is the most damaging thing this product could do — it is the number
> someone acts on with their own money.*

If you want to show it moving, have a second browser signed in as the admin and
change a deal's availability; it lands on the member's screen immediately.

## 7 · What is underneath (1 min)

Open `/admin/providers`.

> *This is the compliance gate. The pipeline refuses to fetch from a provider
> until someone has read their terms and recorded what is permitted — by
> method. An affiliate feed is not consent to be scraped. That is why the
> marketplace is demonstration data today: the pipeline is built and tested,
> and no agreement exists yet to run it against.*

This is the moment a sophisticated investor decides whether to trust the team.
A product that has already said no to itself is a product that will not blow up
later.

Then `/admin/quality`, briefly.

> *Anything not re-checked in 72 hours is flagged. A stale price shown as
> current is the most damaging thing this product could get wrong — it is the
> claim someone acts on with their own money.*

---

## Expect these questions

**"Why not just use an LLM for the recommendations?"**
> Because we have to explain every score, regression-test it, and show a member
> the reason they saw something. A model cannot tell you why it ranked
> something third, and cannot be tested when it changes its mind. The AI does
> have a job here — writing readable copy from facts the engine established —
> and the whole product works with no AI account at all, on a deterministic
> fallback.

**"Where do the deals come from?"**
> Affiliate feeds and partner APIs, once agreements are signed. The engineering
> is done — switching a provider on is filling in a compliance record. The work
> that remains is commercial, not technical. We deliberately did not build
> scraping, because publicly visible is not the same as licensed.

**"What stops a competitor copying this?"**
> The taxonomy and the weights are the hard part, and they only get good with
> real behavioural data. We record ranked position on every click and save, so
> the engine has the raw material to be fitted rather than guessed. The moat is
> the data flywheel plus the social graph — people who plan trips together do
> not move platform individually.

**"How big is the market?"**
> Canada first: nine gateway cities, a population that travels heavily and has
> a bad winter. Canada is the launch market, not an architectural assumption —
> currency, market and gateways are all configuration.

**"Are you liable if someone's trip goes wrong?"**
> We are a search service. We index what travel companies publish, show it with
> the time we last checked, and link out. We never sell travel, take payment
> for travel, or become a party to a booking — and we say so on every listing,
> not just in the terms. The contract is between the member and the provider.
> A lawyer still needs to confirm the provincial registration position before
> launch, and that is in the plan rather than being hoped away.

**"What is the riskiest thing here?"**
> Supply. The engine is built and tested; the marketplace depends on provider
> agreements we do not have yet. That is the honest answer and it is why the
> first raise is for business development, not engineering.

---

## Do not do these

- **Do not call the demo trips real inventory.** Not once, not casually.
- **Do not claim an integration works that has not been run.** If Stripe is not
  configured in this environment, say so.
- **Do not describe anyone as verified.** Email confirmation is email
  confirmation.
- **Do not promise the AI does more than it does.** It writes; it does not rank
  and it does not know things.

Every one of these is a claim that would be checked in diligence, and each one
is easier to make honestly now than to walk back later.

---

## If they want to look under the hood

```bash
npm test          # 291 unit and integration tests, real database
npm run test:e2e  #  48 browser tests, desktop and phone
npm run verify    # an honest report of what is actually configured
```

Then hand them [RECOMMENDATIONS.md](RECOMMENDATIONS.md). It contains the actual
arithmetic, the bugs that were found and fixed, and a "known limitations"
section. Technical diligence goes considerably better when the limitations are
already written down.
