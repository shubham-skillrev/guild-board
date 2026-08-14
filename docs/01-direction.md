# GuildBoard: Direction

Where the product goes, what it refuses to become, and what "9.5" means concretely. Companion to `00-diagnosis.md` and `02-roadmap.md`.

---

## Thesis

GuildBoard is the place an engineering org keeps its collective attention between meetings. It captures what people find interesting, what people ship, and what the guild decided, and it turns that accumulation into an agenda once a month. It is not a chat tool, not a wiki, and not a video conferencing product. It wins by being the shortest path between "I have something worth showing the team" and "the team saw it."

One-line version, usable as the marketing headline:

> **Everything your guild is thinking about, in one place, all month.**

The current headline ("Where Guilds Shape What's Next") is fine but abstract. The subhead on the live site ("Surface ideas. Rally votes. Ship outcomes.") describes the machinery rather than the benefit, and it uses an em dash the repo otherwise removed.

---

## Three pillars

Every feature must serve exactly one of these. If it serves none, it is cut. If it serves two, it is probably two features.

### 1. Ritual (monthly)
The guild meeting. Agenda formation, voting, volunteering to lead, running the meeting, recording outcomes. This is the reason the product exists and it is currently broken at both ends (submission window, dead outcomes path). It has to work before anything else matters.

### 2. Showcase (continuous)
What people shipped. Demos, live links, repos, blog posts, conference talks, LinkedIn posts, internal wins. Peer recognition attached to the work. This is the vision's real payload, it is what makes GuildBoard feel like a company platform rather than a meeting utility, and it is the only mechanic that generates content weekly without anyone being asked to.

### 3. Signal (weekly)
Bytes. Ambient tech news that gives a reason to check in between meetings. Legitimate, but the smallest of the three and currently the most over-built. Its correct home is the guild's Slack channel with a link back, not a top-level destination with 5 API routes and an admin curation panel.

**Ordering matters:** Ritual is repair, Showcase is growth, Signal is garnish. The current codebase has the most engineering invested in the garnish.

---

## Information architecture

Collapse from 5 destinations to 3.

```
BOARD                    FEED                     YOU
├─ Topics (this cycle)   ├─ Showcase posts        ├─ Profile / portfolio
├─ Bank (all ideas)      └─ Bytes (weekly card)   ├─ Sparks given + received
└─ Outcomes (last cycle)                          ├─ Your topics + posts
                                                  └─ Settings + notifications

ADMIN (role-gated, not in nav)
├─ Cycle control
├─ Outcome tagging
└─ Bytes curation
```

Decisions embedded here:

- **Bank becomes a tab on Board, not a fifth destination.** Once the submission window is removed (P0) the distinction between "topic" and "banked idea" largely collapses anyway: an idea is a topic that has not been promoted to the current cycle yet. Consider merging the `idea_bank` table into `topics` with a `cycle_id` nullable column and deleting the parallel model entirely.
- **Leaderboard is demoted into You.** It stops being a podium and becomes a personal record plus a quiet "most sparked this cycle" strip. Do not delete sparks. Delete the ranking as a destination.
- **Feed merges Showcase and Bytes into one chronological stream.** This is the single destination someone opens between meetings. One place, mixed human and machine content, human content dominant. It also means Showcase does not cost a new nav slot.
- **Outcomes lives on Board, above the fold, for the first week of each new cycle**, then collapses. It is the receipt for the previous cycle and it is what makes the current cycle worth participating in.
- **`/bytes` gets into `MobileBottomNav`, or Bytes stops being a destination.** Currently neither is true.

### Screen block budgets

Hard ceilings. If a screen exceeds its budget, something is removed, not shrunk.

| Screen | Today | Target | What goes |
|---|---|---|---|
| `/board` | 7 blocks + 4 overlays | **4 blocks + 1 overlay** | Status strip trimmed to 3 tiles or merged into header, BytesTeaser cut, redundant Bank CTAs cut from 3 visible to 1, overlays coordinated into a single queue |
| `/board/[id]` | 15 blocks | **6 blocks** | SignalRow reduced to 2 signals, AskPanel becomes one button opening a sheet, duplicate vote/contrib/comment counts deduped to one place each |
| `/feed` | new | **1 stream + 1 filter** | n/a |
| `/you` | 3 + 6 (leaderboard) | **4 blocks** | Leaderboard folded in, not stacked |
| `/` (marketing) | 8 blocks | **5 blocks** | Feature triplet with emoji icons replaced by one real product screenshot |

### Overlay policy

Four independently-positioned floating elements with uncoordinated z-index (toast `9999`, `MobileBottomNav` `9999`, `MeetingPill` `9998`, `InstallPrompt` `50` and `PushOptIn` `40` at identical coordinates) is not a layout, it is a collision. Adopt one rule:

> One overlay slot above the bottom nav. A single queue, priority-ordered: toast > meeting pill > push opt-in > install prompt. Never two at once. Install and push prompts are once per user, dismissible permanently, and never shown on first session.

---

## Design system decision

**Finish the migration onto the phase-1 primitives. Delete the old set. Do not run both.**

Rationale: the new primitives (`Surface`, `Button`, `Chip`, `Field`, `Sheet`, `Row`, `RowGroup`) are the better-designed set and they sit on the phase-0 tokens, which the brief judges sound. The old set (`Card`, `Badge`, `Modal`, `Input`) predates the token work. Migrating forward is the same amount of mechanical work as migrating backward, and only one of the two directions leaves you somewhere good.

The naming collision between `Field.tsx` and `Input.tsx` (same four exports, different visuals) makes this urgent. That is a live footgun for anyone touching a form.

### The single system

Pin these once, in `globals.css`, and treat every deviation as a bug.

**Type.** One scale, six steps, no aliases, no hardcoded pixel sizes. Suggested:

```
--t-display  32/36  weight 600  tracking -0.02em
--t-title    22/28  weight 600  tracking -0.01em
--t-heading  17/24  weight 600
--t-body     15/22  weight 400
--t-label    13/18  weight 500  tracking  0.01em
--t-meta     12/16  weight 500  tracking  0.02em   uppercase optional
```

Two faces maximum. A characterful display face used only for `--t-display` and empty-state headlines, and one body face for everything else. Given the audience (engineers, mobile-first PWA, dark surface at `#08080C`), a tight geometric or grotesque display paired with a highly legible UI face reads correctly. Avoid the default stack of Inter everywhere, which is what the product currently reads as.

**Spacing.** 4px base. Allowed values: 4, 8, 12, 16, 24, 32, 48, 64. Nothing else. Every page currently hardcodes padding while only 5 files consume the density tokens; that inverts.

**Radius.** One value for controls, one for surfaces. Suggested `6px` / `12px`. Nothing else.

**Elevation.** `elev-1 / 2 / 3` only. Delete every bespoke shadow.

**Container.** One content width (`720px`) and one wide width (`1040px`). Six widths across seven screens is the clearest signal that no system is being applied.

**Cards.** One treatment for one object type. Around eight treatments for the same object is the main reason the app reads as cluttered even where block count is reasonable.

**Colour.** Neutral surface ramp plus exactly one accent. Retire `wisteria` and `indigo` at the source, not just from new code, so `Badge`, `IdeaCard`, `OutcomesRecap` and `useToast` stop rendering grey. Semantic tokens only in components: `--fg`, `--fg-muted`, `--surface`, `--surface-raised`, `--border`, `--accent`, `--danger`, `--success`.

**Icons.** `lucide-react` only. Remove all four `react-icons` sets, all inline SVG that duplicates a Lucide glyph, and all ~25 emoji doing real UI work. The upvote glyph being three different things across the app is the kind of detail that caps a product at 6/10 no matter how good the features are. Emoji as UI is also the single loudest "internal tool" tell on the marketing page (▲ 🤝 ⚡ as feature icons).

**Motion.** 150-200ms, ease-out, on state change only. No scroll-triggered choreography. Respect `prefers-reduced-motion`. A dense productivity tool earns trust through responsiveness, not through animation.

**Quality floor, unstated but non-negotiable.** Keyboard focus visible on every interactive element. Touch targets 44px minimum. Optimistic UI on vote, spark and signal so nothing waits on a round trip. Skeletons that match final layout, or better, a single coordinated fetch so blocks stop popping in one at a time (the brief notes `/board` fires 5 independent requests from 4 components).

### The signature

A product at 9.5 has one thing people remember. Candidate, and it is the honest one for this product: **the cycle**. GuildBoard is the only tool in the company organised around a repeating monthly rhythm. Make that visible and make it the identity. A persistent, quiet cycle indicator (day 12 of 30, agenda locks in 4 days, 7 topics in play) that appears on every screen in the same place, in the same treatment, and that changes state as the cycle progresses. Not a countdown widget bolted onto the board. A structural element of the chrome.

That also solves a real problem: right now the meeting countdown appears twice on `/board` in two different treatments.

---

## How to actually hook people

Principles, ordered by expected return at n=30.

1. **The trigger lives outside the app.** Slack and the calendar are where the guild already is. Every notification that matters should originate there and deep-link in. In-app hooks only retain people who already opened the app.
2. **Reciprocity beats gamification.** The strongest reason to post again is that the last post got a response. At 30 people this is manageable by hand: a norm that every topic and every showcase post gets at least one substantive reply within 24 hours, with admins as the backstop. This is a policy, not a feature, and it will outperform any points system you can build.
3. **Lower the cost of contributing until it is nearly zero.** Post from Slack. Post from the phone in 15 seconds. Title-only topics allowed, body optional. Paste a link and let the app fetch the title, favicon and OG image. Every field you require is a member you lose.
4. **Make visibility the reward.** Named recognition from real colleagues, on a profile that reads like a portfolio, that a person would actually screenshot into a performance review. That is the reward mechanism that works inside a company. Points are not.
5. **Use the deadline you already have.** The meeting is a real, socially enforced deadline. Lean on it hard: agenda locks Friday, meeting Monday, outcomes Tuesday. Three notifications a month, all consequential, all in Slack. That beats daily engagement pings.
6. **Ship the receipt.** Outcomes recap, posted publicly, naming who proposed and who led. This is the single most under-built thing in the product relative to its importance.

### Anti-patterns to avoid

- Leaderboards and podiums at this population size
- Streaks. A monthly product cannot have a daily streak, and a guild member who breaks one just leaves
- Badges, levels, XP
- Push notifications for anything that is not the three consequential moments
- Any new mechanic whose success metric is "time in app". The correct metric is topics per cycle and posts per week
- Building a second thing before the first thing has usage data

---

## Non-goals

Stated explicitly so they stop competing for attention.

- **Not a chat product.** Comment threads on topics and posts, nothing more. No DMs, no channels. Slack exists.
- **Not a wiki or docs tool.** Confluence and Notion exist.
- **Not a task tracker.** Jira exists.
- **Not building raw WebRTC.** If voice ships, it ships on LiveKit or Daily. See P9.
- **Not multi-tenant, not a SaaS, not open to non-`@skillrev.dev` accounts** until at least two full cycles run cleanly with the new IA.
- **No new feature ships before P3 completes.** The batch that is already live has zero usage evidence. Adding to it makes the evidence problem worse.

---

## Open questions requiring a decision

1. **Merge `idea_bank` into `topics`, or keep two models?** Recommendation: merge. A banked idea is a topic with a null `cycle_id`.
2. **Is Slack or Teams the guild's actual habitat?** The entire P4 phase depends on this. If it is Teams, the work is similar but the SDK differs.
3. **Does the guild meeting have an admin who will tag outcomes every month?** If nobody will do it, outcomes should be deleted rather than built, and the roadmap changes materially.
4. **Should showcase posts be visible company-wide or guild-only?** Company-wide is where the vision points and where the motivation is strongest, but it changes the moderation posture.
5. **Keep Bytes at all?** It survives this document on the assumption that shrinking it to a weekly Slack post plus one Feed card is cheap. If that is still more than a session of work per month to maintain, cut it.
