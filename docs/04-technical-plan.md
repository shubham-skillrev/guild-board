# GuildBoard: 3-Month Technical Plan

Technical companion to `02-roadmap.md`. Eighteen independently shippable units with dependency gates, not calendar dates. Month headings are the expected arc, not commitments.

Four answers since the roadmap was written change the technical shape enough that this needs to be a separate document rather than an edit:

1. **There is no async chat habitat.** Not Slack, not Teams, not Google Chat. Calls are on Google Meet and nothing else exists. This kills roadmap **P4 (the Slack bridge)** outright and it inverts `00-diagnosis.md` Finding 5: the hook is not in the wrong building, there is no other building. GuildBoard has to be the habitat, and the only triggers available are email, calendar, web push and the OS share sheet.
2. **GuildSpaces is a real goal**, not a gated maybe. Voice hosted in GuildBoard, month 3, still behind usage gates, on a managed SFU.
3. **The repo goes public as a read-only showcase.** Not self-hostable, not multi-tenant. LICENSE, CI, secret hygiene and no `skillrev` strings in code, but no setup-guide or org-scoping burden.
4. **Full hygiene is in scope**: GitHub Actions, Vitest, Playwright, strict TS, lint gate. None of it exists today (no `.github/`, no LICENSE, no test files, 27 lint errors at baseline).

---

## Corrections to the existing docs

| Doc                                                            | Claim                                                           | Correction                                                                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `02-roadmap.md` P4                                             | "The Slack bridge, highest-return new work"                     | **Deleted.** Replaced by U11 (capture paths) and U12 (email + calendar). Lower reach, and it must be paired with making GuildBoard itself worth arriving at |
| `00-diagnosis.md` Finding 5                                    | "The hook is in the wrong building"                             | Half right. The mechanism holds: in-app hooks only retain people already in the app. The prescribed fix does not exist here                                 |
| `00-diagnosis.md` / `02-roadmap.md` P9                         | "Voice is the weakest half of the vision", gates plus maybe-buy | Verdict on raw WebRTC stands. Voice is now a planned month-3 build on LiveKit, still gated                                                                  |
| `01-direction.md` non-goals                                    | "Not multi-tenant, not a SaaS, not open beyond `@skillrev.dev`" | Unchanged, and now load-bearing: public **repo**, private **app**                                                                                           |
| `01-direction.md` "quality floor, unstated but non-negotiable" | Listed as an aside                                              | Promoted. U9 owns it and CI enforces part of it. An unowned quality floor is a wish                                                                         |
| This document, first draft                                     | Counts inherited from the original brief                        | Measured against the tree on 2026-08-14. Most held. Four did not: see the corrections below and `docs/audits/ui-audit.md`                                   |

**`docs/audits/ui-audit.md` is written.** It is the per-screen block inventory that defines the scope of U4, U6 and U8, and its section 10 is U4's deletion checklist.

### Corrections from verification

- **`next lint` runs nothing in Next 16.** It prints `Errors: 0 | Warnings: 0` regardless of the code. The real baseline, from `npx eslint .`, is **27 errors, 8 warnings, 15 files**, matching what commit `48fc1bf` recorded. U0 below is written against `eslint` for this reason. A CI gate built on `next lint` would pass forever and the U9 plan to enforce accessibility through that gate would enforce nothing.
- **`.env.local` was never committed.** `git log --all -- .env.local` is empty, it is not in `git ls-files`, and `.gitignore:34` covers `.env*`. U18 needs no history scrub.
- **Scale drift is worse than recorded**: 50 alias type-scale usages (was 45), 24 new-scale (was 17), 204 hardcoded pixel sizes (was ~205), and **8** distinct container widths in `src/app` (was 6).
- **Maskable icons already ship** (`src/app/manifest.ts:19-20`), so U9's PWA work is splash and safe-area insets only.

---

## Architecture decisions

**A1. Board becomes server-rendered, client islands only for interaction.**
`/board` currently fires 5 requests from 4 components (`useCurrentCycle`, `/api/cycles?all=true`, `useTopics`, `OutcomesRecap`, `BytesTeaser`), so the page assembles itself in front of the user. Move the initial read into the page as a React Server Component querying Supabase server-side, pass data down, keep `useTopics`' realtime channel as a client island for live counts only.
_Rejected:_ SWR or TanStack Query. Fixes deduping but not the waterfall, and adds a dependency to solve what RSC already solves here.

**A2. Delete the 15s polling fallback in `useTopics`, but add a visibility refetch.**
`POLL_INTERVAL = 15_000` at `src/hooks/useTopics.ts:19` runs alongside a realtime subscription. With RSC for first paint and realtime for updates, polling is a third mechanism doing a job two already do. **Amendment:** replace it with a refetch on `visibilitychange` and `focus`, not nothing. The failure the poll was accidentally covering is real: iOS Safari suspends the WebSocket when a PWA is backgrounded and does not always resume the subscription cleanly, so a returning user sees stale counts forever. One refetch on resume costs a request per session instead of 240 per hour.

**A3. Merge `idea_bank` into `topics` with a nullable `cycle_id`.**
Once `isSubmissionAllowed` stops gating writes (`src/lib/utils/cycle.ts:22`), a banked idea _is_ a topic with no cycle. Two models for one object is the source of the 5 duplicate "Bank an idea" entry points.
_Rejected:_ keeping both and just moving the route. Cheaper this week, pays rent forever.

**A4. Email over push as the primary trigger. Start the DNS work now.**
Web push is built (`push_subscriptions`, VAPID, `src/lib/push/notify.ts`) and its delivery bug is fixed, but it requires install plus permission plus the OS not suppressing it. Email reaches all 30 members with no opt-in step. **Resend + React Email**, three consequential sends per cycle plus the weekly digest. Push carries the same moments as a secondary channel, and `notification_prefs` finally gets the UI it has been waiting for since migration 008.
_External dependency with lead time:_ Resend needs SPF and DKIM records on `skillrev.dev`. If you do not control that DNS, find out who does in month 1, not the week U12 starts. Everything in U12 is blocked on a DNS record you cannot write yourself.
_Rejected:_ Gmail API or Workspace SMTP. More auth surface, worse templating, no deliverability tooling.

**A5. Calendar via a static agenda link, not the Calendar API.**
The recurring Meet invite gets a live agenda URL in its description, updated by hand once. Google Calendar API (OAuth scopes, token refresh, per-user consent) is disproportionate for one recurring event.

**A6. Voice on LiveKit Cloud.**
Server route mints a room token, client uses `@livekit/components-react`. One room bound to the active cycle's meeting, audio only, hard cap 30.
_Rejected:_ raw WebRTC. Signalling, TURN, mobile Safari, reconnection: a permanent maintenance tax for a monthly 30-person call.

**A7. Link previews go in Postgres, not a cache service.**
A `link_previews` table keyed by URL hash, populated by a server route that fetches OG tags. Permanent, queryable, free.

**A8. Instrumentation is one Postgres table, written by the app.** _(new)_
The U17 gates and the U2 proof both require knowing who opened what and when, and that is not derivable from `topics`, `posts` or `sparks`. Add `events (id, user_id, name, entity_id, created_at)` in migration `016` and fire it on a fixed, tiny vocabulary: `session_start`, `view_board`, `view_feed`, `view_topic`, `post_topic`, `post_showcase`, `vote`, `comment`, `spark`. Nine event names, no properties bag, no schema churn. Every metric in this plan is then a `GROUP BY` away.
_Rejected:_ PostHog, Vercel Analytics, Plausible. At 30 users a vendor buys dashboards you do not need, a cookie banner conversation you do not want, and a third-party script on a page whose whole job is to feel fast. A weekly SQL query in the Supabase console is the correct tool at this size.

**A9. Sentry for errors, from U7 onward.** _(new)_
You are about to run a product you are measuring, on a public repo, with no error visibility at all. Free tier, one session to wire, `@sentry/nextjs`. Scrub `user_id` from event context to keep the anonymity guarantee intact. This is the one observability vendor worth adopting before a failure is observed, because without it you cannot observe failures.

---

## Redis / Upstash: the honest verdict

**Do not adopt it in months 1 to 2.** At 30 members nothing here is throughput-bound, and every usual justification has a cheaper answer: rate limiting is moot while the app is domain-gated to one company, feed caching is a weekly cron writing to Postgres, link previews are a Postgres table (A7), session state belongs to Supabase.

Adopting it now costs a vendor, two secrets, a local-dev divergence and a second source of truth, in exchange for nothing measurable.

| Adopt                                    | When this becomes true                                                                                   | Why Postgres stops being enough                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Upstash QStash**                       | Any single request fans out to more than ~20 side effects, or a cron exceeds the Vercel function timeout | `after()` on serverless is best-effort. A digest emailing 30 people plus generating summaries plus posting outcomes will eventually exceed the request lifetime. A queue with retries and dead-lettering is the correct fix, not a longer timeout. **Most likely trigger point in this plan: U12** |
| **Upstash Redis (`@upstash/ratelimit`)** | GuildSpaces ships, or any endpoint becomes reachable without a session                                   | Token minting and room join are the first endpoints where a loop costs real money. Postgres rate limiting adds a write per request on the hot path                                                                                                                                                 |
| **Upstash Redis (presence)**             | Only if voice presence must outlive a LiveKit room                                                       | LiveKit ships presence. Do not duplicate it                                                                                                                                                                                                                                                        |

Same test for every other new dependency: adopt when a specific failure has been observed, not when a phase begins. The two exceptions above are Sentry (A9) and Resend (A4), both of which are enabling rather than optimising.

---

## The plan

### Month 1: measure, protect, repair

**U0. Hygiene floor** _(do first, it protects every unit after it)_
`.github/workflows/ci.yml` running `tsc --noEmit`, `npx eslint .`, `next build` on push and PR. **Use `eslint` directly, not `next lint`:** the latter is a deprecation shim in Next 16 that runs nothing and reports `Errors: 0 | Warnings: 0` on a codebase with 27 real errors. `package.json`'s `lint` script already calls `eslint`.

Vitest configured, with the first tests on the pure logic everything else trusts: `src/lib/utils/cycle.ts` (all six predicates, boundary cases at `meeting_at`), `src/lib/utils/anonymity.ts` (the `user_id` deletion, since a regression here silently breaks a promise to users), quota enforcement, `CATEGORY_BONUS` scoring. Fix the baseline of **27 errors and 8 warnings across 15 files** to zero, then make the gate blocking. Add `LICENSE` (MIT) and `SECURITY.md`.
_Done when:_ CI is green and blocking, `npm test` passes, `npx eslint .` reports zero.

**U1. Metrics baseline and minimal instrumentation** _(new, promoted from a footnote)_
This was a note in the brief. It is a unit, and it gates U2.

U2 removes the submission window, which is the single change this plan most wants to prove worked. If the baseline is not captured first there is no way to know, and "did opening the board increase topic supply" becomes an argument instead of a query.

Ship A8 (`events` table plus nine event names), then record the six metrics from `02-roadmap.md` for the last two completed cycles by hand from existing data: topics per cycle, unique contributors per cycle, comments per topic, meetings with a full agenda, and current members with a push subscription. Write them into `docs/metrics.md` with the date.
_Done when:_ `docs/metrics.md` exists with two cycles of before-numbers, and `events` is recording.
_Gate:_ U0 green.

**U2. Unblock supply** _(roadmap P0, the single highest-leverage change)_
`isSubmissionAllowed` (`src/lib/utils/cycle.ts:22`) stops gating writes. Migration `016`: `topics.cycle_id` nullable, add `is_open_to_claim BOOLEAN`, backfill every `idea_bank` row into `topics`, update `check_topic_limit()` so the 1-per-cycle cap applies only to topics with a `cycle_id` (uncycled topics unlimited). RLS updated for the null-cycle case. `/api/idea-bank` and `/api/idea-bank/promote` fold into `/api/topics` with a `cycle_id` PATCH. `/bank` becomes a tab on `/board`.
_Gate:_ U0 green (this touches quota triggers and RLS), U1 baseline captured.
_Done when:_ a member posts on any calendar day, and promoting an idea is a `PATCH` setting `cycle_id`.

**U3. Close the loop** _(roadmap P2)_
Build the two admin screens that wire the three orphaned endpoints (`PATCH /api/admin/cycle-control`, `PATCH /api/admin/outcome`, `POST /api/admin/carry-forward`, all with zero UI callers today). Cycle control: open, freeze, close. Outcome tagger: per-topic outcome plus a one-line note. `OutcomesRecap` renders for real.
_Decision gate stands:_ if no admin will spend 10 minutes a month tagging, delete the feature instead of building it.

**U4. Delete-first sweep** _(new, and it must precede U6)_
The brief had U3 migrate every call site onto the new primitives, and then U5, U8 and U9 delete or restructure a large fraction of those same call sites. `BytesTeaser`, the leaderboard podium, `AskPanel`, `SignalRow`-on-cards, the `/bank` route, the Bytes admin curation panel, 5 empty component files, 3 orphaned endpoints and `TopicList`'s unreachable empty state are all going away. Migrating them first is wasted work proportional to how much gets deleted.

Pull all the pure deletions forward into one unit: dead code, duplicate entry points (5 "Bank an idea" down to 1, meeting countdown from 2 to 1), the leaderboard podium, `BytesTeaser`, the Bytes curation panel. No restructuring, no new components, just removal.
_Gate:_ satisfied. `docs/audits/ui-audit.md` section 10 is the checklist, ready to execute.
_Done when:_ the diff is net-negative by several thousand lines and nothing visible regressed.

**U5. Design direction** _(new, decisions only, no migration)_
The brief's U3 migrated everything onto the phase-0 tokens. But `01-direction.md` specifies a type scale, a palette, a typeface pairing and a signature element that **have not been designed yet**. If U6 migrates 205 hardcoded sizes onto the phase-0 scale and the real type scale is chosen afterwards, every call site is touched twice.

So: decide before executing. Output is a single page, `docs/design-system.md`, plus the updated `globals.css` tokens and one throwaway static page rendering every component in every state.

Decisions to close: the two typefaces (display used with restraint, body face for everything else, and not Inter-for-everything, which is what the product currently reads as), the six-step type scale with final numbers, the neutral ramp plus one accent on the `#08080C` surface, radius pair, `elev-1/2/3` values, and the cycle indicator design, which is the signature element and the thing the product should be remembered by.
_Done when:_ every token in `globals.css` is a decision someone can defend, and the component sheet renders.

**U6. Execute the design system** _(roadmap P1, largest unit, split it if needed)_
Now migrate, once, onto the final tokens. Every `Card` / `Badge` / `Modal` / `Input` call site onto `Surface` / `Chip` / `Sheet` / `Field`, then delete the old four (`Input.tsx` first: it collides with `Field.tsx` on all four export names). One type scale replacing 50 alias usages, 24 new-scale usages and 204 hardcoded pixel sizes. One spacing scale, one radius pair, `elev-1/2/3` only, two container widths replacing eight. Lucide only: remove five `react-icons` sets across 13 import sites, duplicate inline SVG, and ~25 emoji doing UI work. Retire `wisteria` and `indigo` at source so `Badge`, `IdeaCard`, `OutcomesRecap` and `useToast` stop rendering grey. Ship the cycle indicator as chrome, replacing both meeting countdowns.
_Done when:_ `grep -r "react-icons" src` is empty, `Card.tsx` does not exist, any two screens read as one product.

**U7. Data layer, overlays, observability**
A1 and A2: `/board` server-rendered in one paint, polling replaced by a visibility refetch, realtime kept for counts. One overlay slot above the bottom nav with a priority queue (toast > cycle indicator > push opt-in > install prompt), replacing four uncoordinated fixed elements at overlapping z-indices and, in two cases, identical coordinates. Wire Sentry (A9).

### Month 2: make it worth opening

**U8. IA collapse to three** _(roadmap P3)_
Board / Feed / You. Leaderboard folds into You. `/board` to 4 blocks, `/board/[id]` to 6: `SignalRow` drops from 4 signals to 2 and leaves the card entirely (a tap target inside a card that is itself a `<Link>`), `AskPanel` collapses to a button opening a `Sheet`.

**U9. Craft pass** _(new, and this is the unit that separates 7 from 9.5)_
U6 makes the product coherent. Coherent is not the same as good. Nothing in the brief owned the difference, so this unit does.

- **Empty states, every screen.** An empty board, an empty feed, a topic with no comments, a profile with no posts. Each is an invitation to act with one clear action, not a shrug. These are the screens a new member sees first and they are currently the least designed.
- **Copy pass, whole app.** Every button label, toast, error, notification subject and empty state. Active voice, an action keeps its name through the whole flow (a button that says "Post" produces a toast that says "Posted"). Includes the marketing page, where "Surface ideas. Rally votes. Ship outcomes." describes the machinery rather than the benefit, and where ▲ 🤝 ⚡ as feature icons are the loudest internal-tool tell on the only public surface. Replace them with one real product screenshot.
- **Motion.** 150 to 200ms, ease-out, state changes only. Optimistic UI on vote, spark and signal so nothing waits on a round trip. `prefers-reduced-motion` respected.
- **Accessibility floor, enforced.** Visible keyboard focus on every interactive element, 44px minimum touch targets, labelled form controls, one `h1` per page. Add `eslint-plugin-jsx-a11y` to the U0 gate and `@axe-core/playwright` to the smoke test, so it stops being a wish. The plugin only enforces anything once U0 runs `eslint` rather than `next lint`. The known worst offender is `SignalRow` at `src/components/topics/SignalRow.tsx:97`, whose pills compute to roughly 20px and 25px of height against a 44px floor.
- **Performance budget, measured.** Targets: LCP under 1.5s on the board over 4G, interaction to next paint under 200ms, no layout shift on the overlay queue. Lighthouse CI on PRs, failing the build under 90 performance or accessibility.
- **PWA polish.** Splash screens, an install prompt that is not shown on first session, and a coherent offline state rather than a blank shell. Maskable icons already ship (`src/app/manifest.ts:19-20`) and the bottom nav already applies `pb-[env(safe-area-inset-bottom)]` (`src/components/layout/NavLinks.tsx:89`), so both are off this list.

_Done when:_ someone who has never seen GuildBoard is handed a phone, and the first thing they say is about the product rather than about it feeling unfinished.

**U10. Capture paths** _(new, replaces the missing half of the Slack bridge)_
The Slack phase had two halves: notifications out, and a very cheap way to get things in (`/guild <idea>`, the "Send to GuildBoard" message action). U12 replaces the first half. Nothing replaced the second, and the second was the larger of the two, because contribution cost is the constraint.

The PWA analogues exist and are nearly free:

- **Web Share Target** in `manifest.json` (`share_target` with `action`, `method: GET`, `params: {title, text, url}`). On Android this puts GuildBoard in the system share sheet: from Chrome, from LinkedIn, from anywhere, Share to GuildBoard creates a banked topic with the URL prefilled. This is the direct replacement for the Slack message action and it is the single cheapest thing in this document.
- **Email-to-post.** Resend inbound webhook on `ideas@`. Reply to the digest, subject becomes the title, and it lands as an uncycled topic. Closest available analogue to the slash command.
- **Quick post.** Title-only is valid, body optional, one field and one button, reachable in one tap from anywhere in the app.
- **iOS Shortcut or bookmarklet** for the platforms Share Target does not cover.

_Gate:_ U2, because all of these create uncycled topics.

**U11. Showcase v1** _(roadmap P5, the vision's payload)_
Migration `017`: `posts` (author, type, title, body, url, og_image, created_at) and `link_previews` (A7). Compose in under 20 seconds: paste a URL, server route fetches OG tags, author adds one line. Reuse `CommentThread` and the sparks mechanic verbatim. One button promotes a post to a topic, which is where Showcase feeds the agenda.

**Distribution is part of this unit, not a later one.** In the original plan the Slack cross-post is what made posting worth doing: you ship, the team sees it that minute, someone reacts. With no chat tool, a showcase post that nobody is told about is a post nobody sees, and at n=30 that loop dies in two weeks. So U11 ships with a minimum notification path: a new post fires push to opted-in members and is guaranteed inclusion in the weekly digest. The digest carries **activity**, not just cycle mechanics, because email is now the only way anyone learns that a colleague shipped something.

_Seed it before launch:_ 10 real posts across all six types, from work people recognise. An empty social surface at n=30 dies in a week.

**U12. Email and calendar bridge** _(replaces the deleted P4)_
Resend plus React Email. Three sends per cycle, all consequential: agenda locks, meeting morning, outcomes recap. Weekly digest as the fourth, carrying showcase activity per U11. Push carries the same moments as a secondary channel. `notification_prefs` gets its settings UI, retiring the orphaned table from migration 008. The recurring Meet invite description gets the live agenda link (A5).
_Gate:_ SPF and DKIM live on `skillrev.dev`. Start this in month 1.
_This is the reach-limited replacement for the Slack bridge._ Slack would have removed the need to open the app. Email can only get someone to click into it, so U8, U9 and U11 have to have made the app worth arriving at.

**U13. Feed** _(roadmap P6)_
Showcase posts and the weekly Bytes card in one chronological stream. `/bytes` retires as a route, Bytes becomes a card type.

**U14. Bytes reduction**
Fold `/api/admin/bytes*` down to generation plus the cron. Keep `lib/bytes/sources.ts`, `generate.ts`, `domains.ts`. Migration `018` drops what the curation panel needed.

### Month 3: onboarding, meeting companion, then voice if the gates pass

**U15. Onboarding and first run** _(new)_
By month 3 the product has three destinations, a cycle model, sparks, signals, showcase types and a voting quota, and a new guild member arrives to all of it at once with no explanation. Currently the first-run experience is an empty board and a bottom nav.

Ship: a three-screen first-run that explains the cycle and nothing else, one seeded action ("post your first idea, it takes 15 seconds"), the U9 empty states doing the teaching from there, and a `/how-it-works` page linked from the profile. Keep it to one session. The goal is that a new member's first 60 seconds ends in a post, not in a tour.

**U16. Meeting companion** _(roadmap P7)_
Present mode (full-screen ranked agenda, one topic at a time, keyboard nav, projectable), per-topic timer, live notes, outcome tagged in-meeting so U3's tagger becomes almost free to operate, and a "Join call" button pointing at the existing Meet link. This is the seam GuildSpaces plugs into: build the room model here, add audio later.

**U17. GuildSpaces v1** _(roadmap P9, gated)_
**Do not start until all three gates pass.** Rewritten so each is a query against `events` (A8) rather than an unmeasurable intuition:

| Gate                                                  | Query                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 15+ of 30 members open the Feed in a typical week     | `count(distinct user_id) where name='view_feed'` over a 7-day window, median of last 4 weeks |
| 8+ showcase posts per month, sustained two months     | `count(*) from posts` grouped by month, last two months both ≥ 8                             |
| Meeting companion used for three consecutive meetings | 3 consecutive cycles with `outcomes` tagged during the meeting window                        |

LiveKit Cloud. Migration `020`: `rooms` bound to a cycle. Server route mints tokens (the endpoint that triggers the Upstash rate-limit condition). Scope hard: one room, audio only, join/leave/mute, speaker indication, cap 30. No recording, no breakouts, no screen share, since Present Mode on a shared screen covers it. Ship it, run one meeting on it, then decide.
_If the gates do not pass, that is a finding, not a failure._ It means the guild does not need GuildBoard to host audio, and the months are saved.

**U18. Public repo cutover**
Order matters here:

1. **No history scrub is required.** Verified: `git log --all -- .env.local` is empty, the file is not in `git ls-files`, and `.gitignore:34` covers `.env*`. No secret has been committed. Rotating the Supabase service role key, VAPID keys, Anthropic key, Resend key and LiveKit credentials at the flip remains sensible hygiene if any of them was ever pasted into a chat, a doc or a deploy log, but it is optional rather than blocking. The general rule still stands for the future: a secret that reaches git history is compromised regardless of any rewrite, because clones and forks exist and GitHub caches unreachable objects.
2. Move the `@skillrev.dev` allowlist from `src/lib/utils/email.ts` into an env var so no company string ships in code.
3. **Read `docs/` as an outsider.** These documents are candid about org size and internal engagement ("~30 members, fewer than 10 contributing", metrics that did not work, features that were built and cut). That candour is what makes them good engineering documents and it is also more than you may want a recruiter or a client to read. Decide deliberately per file: publish, redact the numbers, or keep private. There is no wrong answer, but do not discover it after the flip.
4. Complete `.env.example`. Rewrite root `README.md` as a showcase README: what it is, architecture, screenshots, decisions, links into `docs/`.
5. Flip visibility.

_Explicitly not promised:_ that anyone else can run it.

---

## Unit mapping from the previous draft

| Was                             | Now                       |
| ------------------------------- | ------------------------- |
| U0                              | U0                        |
| (a note in Notes for execution) | **U1 Metrics baseline**   |
| U1                              | U2                        |
| U2                              | U3                        |
| (inside U5/U8/U9)               | **U4 Delete-first sweep** |
| (absent)                        | **U5 Design direction**   |
| U3                              | U6                        |
| U4                              | U7                        |
| U5                              | U8                        |
| (absent)                        | **U9 Craft pass**         |
| (absent)                        | **U10 Capture paths**     |
| U6                              | U11                       |
| U7                              | U12                       |
| U8                              | U13                       |
| U9                              | U14                       |
| (absent)                        | **U15 Onboarding**        |
| U10                             | U16                       |
| U11                             | U17                       |
| U12                             | U18                       |

---

## Schema changes

| Migration                | Unit               | Change                                                                                                                                            |
| ------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `016_unify_topics.sql`   | U1, U2             | `topics.cycle_id` nullable, `is_open_to_claim`, backfill `idea_bank`, rewrite `check_topic_limit()`, RLS for null-cycle rows, `events` table (A8) |
| `017_showcase.sql`       | U11                | `posts`, `link_previews`, spark and comment FKs                                                                                                   |
| `018_bytes_trim.sql`     | U14                | Drop curation-only columns                                                                                                                        |
| `019_drop_idea_bank.sql` | one cycle after U2 | Drop `idea_bank`. **Unconditional and decoupled from voice**                                                                                      |
| `020_rooms.sql`          | U17                | `rooms`. Gated                                                                                                                                    |

The brief coupled dropping `idea_bank` to the rooms migration. If the U17 gates do not pass, that migration never runs and the duplicate table you meant to retire after one cycle lives forever. Split, as above.

Every migration ships with its RLS policy and verification query in the same file, matching `supabase/migrations/README.md`. Migrations 011 to 015 are applied and live.

---

## Testing strategy

| Layer          | Tool                             | Covers                                                                                |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| Pure logic     | Vitest                           | `lib/utils/cycle.ts`, `anonymity.ts`, scoring, quota math. Fast, no DB                |
| API handlers   | Vitest + mocked Supabase         | Auth guards, quota enforcement, anonymity `user_id` deletion                          |
| DB constraints | SQL assertions in each migration | RLS actually denies, triggers actually cap                                            |
| Core loop      | Playwright                       | Sign in, post, vote, comment, admin closes cycle, recap renders                       |
| Accessibility  | `@axe-core/playwright`           | No critical violations on the five main screens (added in U9)                         |
| Performance    | Lighthouse CI                    | Board and feed, budget in U9                                                          |
| CI             | GitHub Actions                   | `tsc --noEmit`, lint, build, unit on every PR. Playwright, axe and Lighthouse on main |

Priority if time is short: anonymity, quota triggers, cycle predicates. Those three are where a silent regression breaks a promise to a user rather than showing an error.

---

## Honest assessment against the 9.5 target

The previous draft, executed perfectly, lands at roughly **7.5**. It is a plan to make GuildBoard coherent, tested and correct, and it does that well. It is not a plan to make it excellent, because nothing in it owned design, copy, onboarding or performance. U5, U9 and U15 exist to close that gap.

Scoring the _plan as now written_, assuming it is executed as specified:

| Axis                     | Aug 2026 | After this plan | What holds it back                                                                                                                     |
| ------------------------ | -------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Core idea                | 9        | 9               | Nothing. It was always sound                                                                                                           |
| Loop integrity           | 3        | **9.5**         | U2 and U3 fix both broken ends                                                                                                         |
| Information architecture | 3        | **9**           | U8 and U15. Three destinations is right for this product                                                                               |
| Visual design            | 4        | **8.5**         | U5 plus U6 plus U9 gets a coherent, well-crafted product. Getting past 8.5 needs iteration and taste applied over months, not one pass |
| Engineering quality      | 2        | **9**           | U0, tests, CI, RSC, Sentry, budgets                                                                                                    |
| Retention design         | 3        | **6**           | **The ceiling.** See below                                                                                                             |
| Showcase surface         | 0        | **8**           | U11 exists and is well shaped, but unproven                                                                                            |
| Evidence base            | 1        | **8**           | U1 plus A8 means decisions become queries                                                                                              |

**Weighted, that is about 8.3.** Good. Not 9.5.

### What actually caps it, and it is not technical

Retention is the low score and it drags everything, because a beautifully built product nobody opens is not a 9.5 product. Three honest constraints:

**1. There is no habitat, and email is a weak substitute.** This is the single biggest structural disadvantage in the plan and no amount of engineering removes it. Slack would have let GuildBoard live where people already are. Email gets one open and one decision per send. U10's capture paths are the best available compensation and they are still worse than a slash command. Plan for reach that is genuinely lower than the roadmap originally assumed.

**2. n=30 with fewer than 10 contributing is below the density most social mechanics need.** A feed needs enough posts that opening it is usually rewarded. At 30 people that is roughly two posts a week, sustained, forever. That is achievable but it is not automatic, and it depends on about six people forming a habit. If those six do not, no feature in this document saves it.

**3. Nothing here is validated.** Everything from the 2026-08-14 batch is a hypothesis with zero usage evidence, and Showcase, the largest new bet, is also a hypothesis. U1 makes the hypotheses testable, which is the honest maximum available right now.

### What would actually get to 9.5

Not more units. Three things this plan cannot schedule:

- **Two cycles of real usage after U12,** with the metrics moving. Topic supply up after U2, feed opens up after U11. A product is not 9.5 until it works on people.
- **A second pass on design after those two cycles.** U5 through U9 is one pass, and one pass by anyone is a 8ish. Excellence is the third iteration on screens you have watched people use. Budget a second design unit in month 4 and do not try to front-load it.
- **A social norm, enforced by you, that every post gets a reply within 24 hours.** This is a policy, not a feature, and at this size it will outperform every mechanic in this document. `01-direction.md` says this and it remains the highest-leverage unbuilt thing.

The realistic arc: **8.3 at the end of month 3, 9.5 achievable in month 5 or 6** if the metrics move and you take the second design pass. A plan that claimed 9.5 in three months would be a plan that had not counted the design work.

---

## Notes for execution

- Leave the working-tree deletion of `docs/redesign-plan.md` alone. Stage nothing.
- Prose style: plain, specific, reasons stated, no em dashes.
- Cite `file:line` for every checkable claim.
- The 2026-08-14 batch is one day old with zero usage evidence. U1 must ship before U2 or removing the submission window becomes unprovable.
- `docs/audits/ui-audit.md` is written and its section 10 is U4's checklist. `docs/audits/feature-audit.md` remains unwritten and gates nothing.
- Counts in this document were measured on 2026-08-14. Anything marked inherited in the audit was not re-counted.
- Start the SPF/DKIM conversation in month 1 (A4).

## Verification

1. `find docs -type f` lists the six docs plus `metrics.md` and `design-system.md` as they are produced
2. `git status --porcelain` shows only untracked additions under `docs/` plus the pre-existing deletions. No source file modified
3. Every unit traces to a finding in `00-diagnosis.md`, a phase in `02-roadmap.md`, or is explicitly listed as new in the mapping table
4. Spot-check the claims driving U2 and U3: `src/lib/utils/cycle.ts:22` for the submission gate, and zero UI callers for `/api/admin/outcome`, `/api/admin/cycle-control`, `/api/admin/carry-forward`
5. Confirm the Redis section states trigger conditions rather than a flat no
6. Confirm every U17 gate is expressible as a SQL query against `events` or `posts`
