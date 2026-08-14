# GuildBoard: Diagnosis

Written 2026-08-14, after the 12-commit batch landed. This document is the "why" layer that sits above the feature and UI audits. It is written from the task brief, the product vision, and the public marketing page. It has not been verified against the repo, so every code-level claim here is inherited from the brief and marked as such.

---

## What GuildBoard is actually for

Strip the features away and the original insight is one sentence:

> A monthly engineering guild meeting has no agenda unless someone is accumulating one all month, and nobody accumulates one unless there is a shared place to put things.

That is a real, unglamorous, correct product idea. The failure mode it solves (a 30-person meeting that ends in 8 minutes because nobody prepared) is genuinely painful and genuinely common. The founding loop was:

```
tech happens all month  ->  someone posts a topic  ->  others vote and volunteer
                        ->  meeting has an agenda  ->  outcomes recorded
                        ->  the record makes the next post feel worth writing
```

Everything in the app should be judged on whether it strengthens a link in that chain. Most of what shipped on 2026-08-14 does not.

---

## Finding 1: idea decay was engineered, not organic

The brief states that `isSubmissionAllowed` locks the board roughly 25 days out of every 30, and calls this "the strongest premise in the batch" as justification for the Idea Bank.

Read that again against the founding insight. The product exists because ideas arrive unpredictably throughout the month. The product is closed to submission for 83% of the month. So the sequence for a typical member is:

1. Tuesday, week 2 of the cycle: reads something genuinely worth discussing
2. Opens GuildBoard
3. Cannot post
4. Never returns to it, because the idea has a shelf life of about four hours

The reported symptom was "idea numbers started dropping after 3-4 meetings." The most likely cause is not waning enthusiasm. It is that the honeymoon supply of stockpiled ideas ran out, and after that the only ideas that ever made it in were the ones a person happened to have during the 5-day open window.

The Idea Bank is a workaround for a self-inflicted constraint. It is the right instinct applied to the wrong layer. The correct fix is to remove the constraint: **the board should accept ideas 365 days a year.** The cycle should govern what is *on the agenda*, not what may be *written down*.

This is the single highest-leverage change available and it is roughly a one-session job. Everything else in this roadmap is downstream of it.

## Finding 2: a demand problem was treated as a supply problem

Twelve features shipped in one day. Six of them (Idea Bank, one-tap signals, direct asks, Bytes, outcomes recap, status strip) are ways to *put more things in front of the user*.

But the constraint was never that members lacked surfaces to interact with. Ten active contributors and a monthly cadence means the guild needs somewhere between six and ten good topics a month to function. That is not a volume problem, it is a trigger problem: nobody was being prompted at the moment they had something to say.

Adding surfaces to an app that people were not opening is pushing on the wrong end. It also produced the observable cost documented in the UI audit: 7 blocks plus 4 floating overlays on `/board`, 15 blocks on `/board/[id]`, five separate entry points to "bank an idea" with three visible simultaneously. Users read that density as "this app wants a lot from me", which raises the cost of contribution at exactly the moment you were trying to lower it.

## Finding 3: the monthly loop does not currently close

Per the brief, `PATCH /api/admin/outcome` and `PATCH /api/admin/cycle-control` have zero UI callers. Cycles therefore never reach `closed` or `frozen`, `/api/outcomes` always returns `{cycle: null}`, and `OutcomesRecap` can never render.

This is the most important dead path in the codebase, and not because of the wasted component. The outcomes recap is the *payoff* in the founding loop. It is the thing that tells member #14 that the topic they posted in June actually got discussed, and that is the entire reason they would post again in July. Without it the loop is:

```
post an idea -> vote -> meeting happens somewhere else -> silence
```

That loop has no reason to run twice. Fixing it is roughly one admin screen.

## Finding 4: the retention mechanics chosen do not work at n=30

**Leaderboards.** A top-3 podium where fewer than 10 people can realistically score means 27 of 30 members open the leaderboard and learn that they are not on it. At company scale, points are a weak motivator (they are not legible to anyone who matters, they do not appear in a performance review, and everyone knows the guild is small enough that rank is mostly a function of who had a slow sprint). Named visibility to actual colleagues is a strong motivator. GuildBoard has the weak one built out as a top-level nav destination and the strong one nowhere.

**Sparks.** Peer-to-peer recognition is the right mechanic and it is currently buried under the wrong container. Sparks work because a specific colleague chose to give you one. That should be attached to the work, visible on the profile, and possibly surfaced in Slack. It should not be a scoreboard.

**Bytes.** The instinct behind it was correct and worth naming clearly: a monthly product gives a member 12 touchpoints a year, which is not enough to form any habit at all. Something weekly was needed. But an AI-generated tech digest carries no social obligation. Nobody feels anything about skipping a robot's newsletter. Meanwhile it is, per the brief, the highest surface-area-to-evidence ratio in the codebase: 5 API routes, 3 tables, a cron, an external SDK, a ranking model, a domain classifier and an admin curation panel, and it is absent from `MobileBottomNav` so most members cannot reach it on the device the PWA was built for.

Compare: "Priya shipped a thing and posted a live link" carries real social weight, generates real comments, and costs one table.

## Finding 5: the hook is in the wrong building

Every retention mechanism in the batch fires inside GuildBoard. That requires a member to already have opened GuildBoard, which is the thing they are not doing.

A PWA push notification competes with 40 other apps for attention on a phone home screen. A message in the Slack channel the guild is already sitting in all day competes with nothing, because they are already there. The guild's real habitat is Slack (or Teams) and the calendar invite. GuildBoard currently has no presence in either.

The highest-return integration work is not another in-app surface. It is:

- weekly digest posted into the guild channel, with a link
- meeting-day agenda drop, ranked topics, into the channel that morning
- post a topic from Slack without opening the app
- outcomes recap posted into the channel after the meeting
- calendar invite whose description is a live link to the current agenda

This is cheap relative to what already shipped, and it is where the "hook" the batch was chasing actually lives.

## Finding 6: two design systems means zero design systems

Per the brief: `Surface`, `Chip`, `Sheet`, `Field`, `Row`, `RowGroup` shipped with **0 importers**, while `Card`, `Badge`, `Modal`, `Input` remain in use. `Field.tsx` and `Input.tsx` export the same four names with different visuals. Three type scales coexist (17 new-scale, 45 alias, ~205 hardcoded pixel sizes). Six container max-widths across seven screens. Around eight card treatments for one object. Retired `wisteria` and `indigo` are still requested by four components and now render as indistinguishable grey.

A half-migrated design system is strictly worse than no design system, because it removes the one benefit a design system has (a single place to make a change) while keeping all the cost. This is also the whole gap between "functional internal tool" and the 9.5 the vision asks for. Nothing about the current visual state is unfixable, but it will not be fixed by adding a phase 2.

The abandonment of the Apple reset at the end of phase 1 of 4, with `docs/redesign-plan.md` and the `apple-design` skill deleted in the working tree, means the codebase is currently frozen mid-migration with no written destination. That has to be resolved before any new feature ships, or every new feature doubles the migration debt.

---

## What this means for the stated vision

The stated end-state is: WebRTC voice spaces for running the guild meeting inside GuildBoard, plus product demos, live links, blog posts and LinkedIn posts, forming a company-internal showcase and collaboration network.

Two halves of that vision have very different value.

**The showcase half is the strongest idea in this document.** It is genuinely under-served inside companies, it has intrinsic motivation that no points system can manufacture (being seen by your peers and your leadership for work you are proud of), and it feeds the founding loop directly: a guild agenda mostly writes itself from what people shipped that month. It also fixes the cadence problem honestly, because people ship things weekly. This should be the next major build.

**The voice half is the weakest.** Raw WebRTC is a large, ongoing, high-maintenance build (signalling, TURN, reconnection, mobile Safari, echo cancellation, recording) whose output is a worse version of a tool the company already pays for and which is already in the calendar invite. The competitive advantage was never "we host the audio". It was always "the agenda, the artifacts and the record live in one place." You can capture close to all of that value with a *meeting companion*: a present mode showing the ranked agenda live, a per-topic timer, notes captured in-line, outcomes tagged as the meeting runs, and a "Join call" button pointing at Meet or Zoom.

If voice is still wanted after that ships, buy it. LiveKit or Daily gives you an SFU, mobile SDKs and reconnection handling for a few lines of config. Writing your own signalling layer for a 30-person monthly meeting is not where the differentiation is.

Recommendation: **showcase before voice, meeting companion before voice, and voice only behind explicit usage gates** (see `02-roadmap.md`, P9).

---

## Honest scoring against the 9.5 target

| Axis | Today | Main blocker |
|---|---|---|
| Core idea | 9 | Nothing. The founding insight is sound |
| Loop integrity | 3 | Submission window closed 25/30 days; outcomes path dead |
| Information architecture | 3 | 5 nav destinations, 15-block detail page, 4 colliding overlays |
| Visual design | 4 | Two design systems, three type scales, six container widths, emoji as UI |
| Retention design | 3 | Every hook fires inside an app nobody opens; leaderboard is net-negative at n=30 |
| Showcase / vision surface | 0 | Not built |
| Evidence base | 1 | Twelve features, one day old, zero usage data |

Getting to 9.5 is not a matter of building more. Roughly the first four phases of the roadmap are deletion, consolidation and repair, and they are what will move the score most.

---

## The one thing to internalise

Every feature in the 2026-08-14 batch is one day old and has zero usage evidence. Every rationale in the commit bodies is a hypothesis. Some of them are good hypotheses. None of them are findings. The most expensive mistake available right now is to treat the batch as a foundation to build on rather than a set of bets to prune.
