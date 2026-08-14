# GuildBoard: Roadmap

Ten phases, ordered, each independently shippable. Sized in **sessions** (one focused weekend block, roughly 4 to 6 hours) rather than calendar weeks, since the work happens as time allows.

**The order is cheapest-and-most-load-bearing first.** P0 through P3 are repair, deletion and consolidation. No new features until P4. This is deliberate: the product does not have a feature deficit, it has an evidence deficit and a coherence deficit.

| Phase | Name | Sessions | Type |
|---|---|---|---|
| P0 | Unblock supply, delete dead weight | 1 | Repair |
| P1 | One design system | 2-3 | Consolidation |
| P2 | Close the monthly loop | 1 | Repair |
| P3 | Collapse the IA to three | 2 | Consolidation |
| P4 | The Slack bridge | 2 | New, highest return |
| P5 | Showcase v1 | 3 | New, the vision |
| P6 | The Feed | 1 | Consolidation |
| P7 | Meeting companion | 2 | New |
| P8 | Profile as portfolio | 1 | New |
| P9 | Voice spaces (gated) | 4+ | Conditional |

---

## P0. Unblock supply, delete dead weight

**Goal:** stop the product working against its own premise, and remove everything that is not doing a job.

**Changes**

1. **Remove the submission window.** `isSubmissionAllowed` no longer gates writing. Anyone can post a topic any day of the month. The cycle governs which topics are on the current agenda, not whether writing is permitted. Topics posted outside the active window land with a null / next `cycle_id`.
2. **Fix the overlay collision.** One overlay slot above the bottom nav, single priority queue: toast > `MeetingPill` > `PushOptIn` > `InstallPrompt`. Never two at once. Install and push prompts suppressed on first session, dismissible permanently.
3. **Delete dead code.** The 5 empty 8-byte component files, the 3 orphaned admin API endpoints, `TopicList`'s unreachable empty state, the `notification_prefs` table if no settings UI is planned before P8.
4. **Cut duplicate entry points.** "Bank an idea" goes from 5 entry points (3 simultaneously visible on `/board`) to 1. Meeting countdown appears once, not twice.
5. **Add `/bytes` to `MobileBottomNav`,** or remove `BytesTeaser` from the board. Currently the feature is promoted on desktop and unreachable on the primary client.
6. **Single coordinated fetch on `/board`.** Five independent requests from four components means the page assembles itself in front of the user.

**Done when:** a member can post an idea on any calendar day, `/board` renders in one paint, and no two floating elements can occupy the same coordinates.

**Why first:** this is the highest-leverage change in the entire document and it is one session. Everything downstream assumes an open board.

---

## P1. One design system

**Goal:** make every subsequent phase cheap by having one place to change anything.

**Changes**

1. **Migrate all `Card` / `Badge` / `Modal` / `Input` usage onto `Surface` / `Chip` / `Sheet` / `Field`.** Delete the old four. Resolve the `Field.tsx` / `Input.tsx` export collision by deleting `Input.tsx`.
2. **One type scale.** Six steps in `globals.css`. Kill all 45 alias usages and all ~205 hardcoded pixel sizes. This is find-and-replace, tedious, and worth an entire session on its own.
3. **One spacing scale** (4px base, eight allowed values), **one radius pair**, **elevation via `elev-1/2/3` only**, **two container widths**.
4. **One card treatment per object type.** Eight treatments for the same object collapses to one.
5. **Retire `wisteria` and `indigo` at the source.** Update `Badge`, `IdeaCard`, `OutcomesRecap`, `useToast` so nothing renders as accidental grey.
6. **Lucide only.** Remove four `react-icons` sets, all duplicate inline SVG, and every emoji doing UI work including the marketing page's ▲ 🤝 ⚡.
7. **Ship the cycle indicator** as the chrome signature: same position, same treatment, every screen. This replaces both meeting countdowns.

**Done when:** `grep -r "react-icons"` returns nothing, one type scale is in use, `Card.tsx` does not exist, and a screenshot of any two screens side by side reads as one product.

**Note:** do this before any new feature. Every feature built during a half-migration doubles the migration.

---

## P2. Close the monthly loop

**Goal:** the payoff at the end of the cycle actually exists, so posting has a point.

**Changes**

1. **Build the admin cycle control screen.** One page. Open a cycle, freeze it (agenda locks), close it. Wires `PATCH /api/admin/cycle-control`, which currently has zero callers.
2. **Build the outcome tagger.** A list of the cycle's discussed topics with a per-topic outcome field (discussed / actioned / parked / carried forward) and a one-line result note. Wires `PATCH /api/admin/outcome`.
3. **`OutcomesRecap` renders for real.** Above the fold on `/board` for the first week of a new cycle, then collapsed. Names who proposed and who led.

**Done when:** a full cycle runs end to end, `/api/outcomes` returns a populated cycle, and the recap is visible on the board.

**Decision gate:** if no admin will commit to spending 10 minutes a month tagging outcomes, delete the feature instead of building it. A recap that is empty half the time is worse than no recap.

---

## P3. Collapse the IA to three

**Goal:** the app stops feeling like it wants something from you.

**Changes**

1. **Nav becomes Board / Feed / You.** (Feed is Bytes only until P5, then Bytes plus Showcase.) Admin is role-gated and out of nav.
2. **Bank becomes a tab on Board.** Ideally merge `idea_bank` into `topics` with a nullable `cycle_id` and delete the parallel model. If that is too much for one session, keep the table and just move the route.
3. **Leaderboard folds into You.** The top-3 podium is deleted. Sparks survive as a personal record plus a quiet "most sparked this cycle" line.
4. **`/board` to 4 blocks:** cycle indicator (chrome), outcomes-or-status strip, topic list, one submit action. Status strip drops from 4 tiles to 3 (tile 1 duplicated `MeetingPill`).
5. **`/board/[id]` to 6 blocks:** header, body, one signal row (2 signals, not 4), contributors, comments, one action bar. `AskPanel` becomes a button that opens a `Sheet`. `SignalRow` is removed from the card in list view entirely, since a tap target inside a card that is itself a `<Link>` is the worst interaction in the app.
6. **Bytes shrinks:** cut `BytesTeaser` from the board, cut the admin curation panel, keep generation and the reading view. This removes most of the 5 API routes.

**Done when:** three nav items, no screen over budget, and a new guild member can be shown the whole app in 60 seconds.

**This is the end of repair. The product should now be a clean 7/10 with zero new features added.**

---

## P4. The Slack bridge

**Goal:** move the hook out of the app and into the room the guild already sits in. This is the highest-return new work in the roadmap and it is smaller than most of what already shipped.

**Changes**

1. **Slack app with a bot token.** (Foundational Slack API work was scoped previously and can be reused.)
2. **Three consequential posts per cycle,** into the guild channel:
   - *Agenda locks Friday:* current ranked topics, vote links, "3 votes left" per person
   - *Meeting morning:* final agenda, who is leading what, join link
   - *Day after:* outcomes recap, naming proposers and leaders
3. **Weekly:** Bytes digest as a Slack post with a link back. This becomes Bytes' primary delivery channel.
4. **`/guild <idea>` slash command.** Posts a topic without opening the app. Title-only is valid. This is the single biggest reduction in contribution cost available.
5. **Message action: "Send to GuildBoard."** Any interesting link someone drops in any channel becomes a banked idea in two clicks.
6. **Calendar:** the recurring meeting invite description carries a live link to the current agenda.

**Done when:** a member can contribute a topic and read the digest without ever opening the PWA, and three Slack posts land per cycle automatically.

**Measure this one.** Compare topics-per-cycle before and after. If the slash command produces more topics than the app does, that is your answer about where the product lives.

---

## P5. Showcase v1

**Goal:** the vision's actual payload. The thing that makes GuildBoard a company platform rather than a meeting utility.

**Changes**

1. **One new table, `posts`.** Fields: author, type (demo / live link / repo / blog / talk / launch), title, body (optional, markdown), url, og-image, created_at.
2. **Compose in under 20 seconds.** Paste a URL, the app fetches title, favicon and OG image, author adds a one-line "why this matters." Nothing else is required. From the phone.
3. **Kudos, not points.** Reuse the sparks mechanic: named recognition from a specific colleague, shown on the post and on the author's profile. No leaderboard, no totals in nav.
4. **Comments reuse the existing `CommentThread`.** No new comment model.
5. **Slack cross-post.** Every showcase post drops into the guild channel automatically, with the author's name and the link. This is what makes posting worth doing.
6. **Promote to topic.** One button on a post: "Discuss at the next guild." Creates a topic linked to the post. This is where Showcase feeds Ritual and the agenda starts writing itself.

**Done when:** a member ships something, posts it in 20 seconds from their phone, the team sees it in Slack the same minute, and it can become a meeting topic in one tap.

**Seed it.** Do not launch to an empty feed. Post 10 things yourself first, covering all six types, from real work people recognise. An empty social surface at n=30 dies in a week.

---

## P6. The Feed

**Goal:** one place to check between meetings.

**Changes**

1. Merge Showcase posts and the weekly Bytes card into one chronological stream at `/feed`. Human content dominant, Bytes as a single card in the stream on the day it generates.
2. One filter row: All / Shipped / Reading. Nothing else.
3. `/bytes` as a standalone route is retired. Bytes becomes a card type.

**Done when:** two nav destinations collapse into one, and the Feed is the screen people open by reflex.

---

## P7. Meeting companion

**Goal:** capture the value of "run the meeting in GuildBoard" without building a video product.

**Changes**

1. **Present mode.** Full-screen, ranked agenda, one topic at a time, large type, keyboard navigation. Projectable.
2. **Per-topic timer.** Visible to the room. This alone changes the character of a guild meeting.
3. **Live notes** captured per topic during the meeting by whoever is scribing.
4. **Outcome tagged in-meeting,** not afterwards by an admin who has to remember. This makes P2's tagger almost free to operate.
5. **"Join call" button** pointing at the existing Meet or Zoom link. GuildBoard is the agenda, the other tool is the audio.

**Done when:** the guild runs a full meeting with GuildBoard on the shared screen and outcomes are tagged before the meeting ends.

**This phase is deliberately positioned where WebRTC would have been.** It delivers most of the meeting-in-GuildBoard value at roughly a tenth of the cost and zero ongoing infrastructure burden.

---

## P8. Profile as portfolio

**Goal:** make the reward legible enough that someone would screenshot it.

**Changes**

1. Profile becomes: what you shipped (showcase posts), what you proposed (topics), what you led (contributions), who recognised you (sparks, with names and reasons).
2. Sparks show the giver and the context, not a count.
3. Shareable, internally. Optionally exportable as a "my year in the guild" summary around review season.
4. Notification settings finally get a UI, which retires the orphaned `notification_prefs` table one way or the other.

**Done when:** a member can point their manager at their GuildBoard profile as evidence of contribution.

---

## P9. Voice spaces (conditional)

**Do not start this until all three gates pass:**

- At least 15 of 30 members open the Feed in a typical week
- At least 8 showcase posts per month, sustained over two months
- Meeting companion used for three consecutive guild meetings

If the gates pass, build on **LiveKit or Daily**, not raw WebRTC. Buying the SFU, mobile SDKs, TURN and reconnection handling turns a multi-month build with permanent maintenance into roughly a session of integration.

Scope v1 hard: one room, tied to the active meeting, audio only, join and leave, mute, speaker indication, and hard cap at 30. No recording, no breakouts, no screen share (the presenter uses Present Mode on a shared screen). Ship it, run one meeting on it, then decide.

If the gates do not pass, the answer is that the guild does not need GuildBoard to host audio, and that is a valid and money-saving finding.

---

## What to measure

At 30 members, do not build analytics. Count these by hand in a spreadsheet, monthly, five minutes.

| Metric | Why | Healthy at n=30 |
|---|---|---|
| Topics per cycle | The founding metric. Everything else is instrumental | 8-12 |
| Unique contributors per cycle | Is it the same 4 people | 12+ of 30 |
| Showcase posts per month (after P5) | Is the vision working | 8+ |
| Weekly opens (after P4) | Did moving the hook to Slack work | 15+ of 30 |
| Comments per topic | Reciprocity. If this is under 1, the loop is dead regardless of everything else | 2+ |
| Meetings with a full agenda | The actual product outcome | 100% |

**Baseline all six before P0 ships,** even roughly. Without a baseline you will not be able to tell whether removing the submission window worked, and that is the one thing you most want to know.

---

## What is explicitly not on this roadmap

- Any new engagement mechanic before P4 has data
- Streaks, badges, levels, XP
- Multi-tenancy or opening beyond `@skillrev.dev`
- AI features beyond the existing Bytes generation
- Any redesign phase 2, 3 or 4 of the abandoned Apple direction. P1 is the redesign. There is not another one.
