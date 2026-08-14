# Audit Brief v2: Understand Before Rebuilding

Revision of the original 2026-08-14 brief. The original scope (three descriptive documents, zero code changes) was correct and is retained. What changed:

- The **root cause was missing.** `isSubmissionAllowed` closing the board ~25 days a month appeared only as supporting evidence for the Idea Bank. It is the primary finding and it now has its own row.
- **Three decisions the original left open are now closed:** the design system question, the outcomes build-or-delete question, and the leaderboard question.
- Every feature is now judged against a **pillar** (Ritual / Showcase / Signal, see `01-direction.md`). A feature serving no pillar is cut regardless of how well it is built.
- **`docs/03-direction.md` is superseded** by `docs/01-direction.md` and `docs/02-roadmap.md`, which are already written. The remaining work is the two in-repo audits.

---

## Context

GuildBoard shipped 12 commits on 2026-08-14 that roughly doubled its surface area: an idea bank, one-tap topic signals, direct member asks, an AI-generated weekly tech digest (Bytes), an outcomes recap, a dashboard status strip, and two phases of an "Apple-native" design reset. All of it is committed and migrations 011 to 015 are applied and live.

The result reads cluttered. `/board` renders up to 7 page blocks plus 4 independently-positioned floating overlays. `/board/[id]` renders 15 blocks. Two design systems run side by side: new tokens and primitives shipped, old ones never removed, new primitives largely unimported. The working tree has `docs/redesign-plan.md` and `.claude/skills/apple-design/SKILL.md` deleted and a new `design-taste-frontend` skill added, so the previous design direction was abandoned mid-migration at the end of phase 1 of 4.

Every feature is roughly one day old. "Live" means deployed, not validated. There is no usage evidence for any of it. The guild is ~30 members with fewer than 10 contributing.

**Intended outcome:** documentation only. Two markdown files that make the current state legible. No code changes. The user decides what to cut after reading.

---

## Deliverables

Two files in `docs/audits/`. The direction and roadmap already exist at `docs/01-direction.md` and `docs/02-roadmap.md` and should not be regenerated.

### 1. `docs/audits/feature-audit.md`

Per feature, a fixed structure:

- **What it is** — user-facing description, routes / components / tables / APIs with file paths
- **Pillar** — Ritual, Showcase, Signal, or none
- **Stated rationale** — quoted from the commit body, the author's own words
- **Does the reasoning hold** — is the premise factually true in this codebase, is the mechanism plausible, what would prove or disprove it
- **Actual cost** — files, tables, API routes, UI blocks
- **Status** — working / partially wired / dead

Features to cover, with the commit that added them:

| Feature | Commit | Surface added |
|---|---|---|
| Anonymity enforcement | `cb0aa0b` | `src/lib/utils/anonymity.ts`, all topic APIs |
| Leaderboard restructure (top-3, per-cycle, A-Z spark picker) | `cb0aa0b` | `src/app/(main)/leaderboard/page.tsx` |
| Push delivery fix (`after()`) | `cb0aa0b` | `src/lib/push/notify.ts` |
| Idea Bank | `ed2f42f` | `/bank`, 2 APIs, 2 components, `idea_bank` table |
| Outcomes recap | `34ca65f` | `src/components/board/OutcomesRecap.tsx`, `/api/outcomes` |
| One-tap topic signals | `3aa2ea0` | `SignalRow.tsx`, `/api/topic-signals`, `topic_signals` table |
| Comment dislikes removed | `3aa2ea0` | `CommentThread.tsx`, `/api/comment-reactions` |
| Ask a member in | `88523cc` | `AskPanel.tsx`, `/api/topic-asks`, `topic_asks` table |
| Bytes (digest) | `0a407da`, `ee28a12`, `f0fc596` | `/bytes`, 5 APIs, cron, 3 tables, Anthropic SDK, `lib/bytes/*` |
| Board to dashboard (status strip, BytesTeaser) | `f0fc596` | `board/page.tsx`, `Section.tsx`, `BytesTeaser.tsx` |
| Design phase 0 (tokens, elevation, density, Lucide) | `0cb62bf` | `globals.css`, `ui/Icon.tsx` |
| Design phase 1 (primitives) | `55f9eee` | `Surface`, `Button`, `Chip`, `Field`, `Sheet`, `Row` / `RowGroup` |

**Plus one row the original brief did not have:** `isSubmissionAllowed`, the pre-existing submission window. Not part of the batch, but the finding that reframes it.

#### Decision table

| Item | Pillar | Call | Reasoning |
|---|---|---|---|
| **Submission window (`isSubmissionAllowed`)** | Ritual | **Remove entirely** | The board is closed to writing ~25 of 30 days. The product exists because ideas arrive unpredictably all month. This is the most likely cause of the reported idea decay and it is one session to fix. The cycle should govern what is on the agenda, not what may be written down |
| Anonymity, push fix, dislike removal | Ritual | **Keep** | Correctness fixes, no UI cost |
| Idea Bank | Ritual | **Keep, demote to a tab** | Its premise mostly evaporates once the submission window is removed, since a banked idea just becomes a topic with a null `cycle_id`. Strongly consider merging `idea_bank` into `topics` and deleting the parallel model. Either way it is a tab on `/board`, not a fifth nav destination with 5 entry points |
| Outcomes recap | Ritual | **Keep and finish. Highest-priority build in the repo** | The original brief called it "keep, but dead today." That undersells it. `PATCH /api/admin/outcome` and `PATCH /api/admin/cycle-control` have zero UI callers, so cycles never reach `closed` / `frozen` and `/api/outcomes` always returns `{cycle: null}`. The recap is the payoff that makes posting worth repeating. Without it the loop has no reason to run twice. Build the admin screen (~1 screen, P2) or delete the feature and accept the loop stays open |
| Topic signals | Ritual | **Trim to 2, detail page only** | 4 signal types on both card and detail. `SignalRow` inside a card that is itself a `<Link>` is the densest and worst interaction in the app |
| Ask a member in | Ritual | **Defer, collapse to a button + sheet** | Premise is sound but overlaps comments. Costs a full panel on an already-15-block page |
| Bytes | Signal | **Keep, shrink hard, move delivery to Slack** | Highest surface-area-to-evidence ratio in the codebase: 5 API routes, 3 tables, a cron, an external SDK, a ranking model, a domain classifier and an admin curation panel, all for an unvalidated reason to open the app mid-cycle. Also absent from `MobileBottomNav`, so most members cannot reach it on the primary client. Cut the board teaser and the admin curation panel. Deliver the digest as a weekly Slack post with a link back, and keep one reading view as a card in the Feed |
| Board status strip | Ritual | **Replace with the cycle indicator in chrome** | Tile 1 duplicates `MeetingPill`, on screen simultaneously in the final 48h. The countdown should exist once, in the chrome, on every screen (see `01-direction.md`, "The signature") |
| Leaderboard as a nav destination | none | **Demote into You, delete the podium** | A top-3 podium where fewer than 10 people can score means 27 of 30 members learn they are not on it. Points are a weak motivator between colleagues. Keep sparks, which are named peer recognition and the strong version of the same idea. Kill the ranking |
| Design phase 0 tokens | — | **Keep** | Semantic colour, elevation and the `--control-h` density shift are sound and cheap |
| Design phase 1 primitives | — | **Keep, finish the migration, delete the old set** | Decision closed. `Surface`, `Chip`, `Sheet`, `Field`, `Row`, `RowGroup` have 0 importers while `Card`, `Badge`, `Modal`, `Input` are in use. Migrating forward and migrating backward cost the same, and only one leaves you somewhere good. The `Field.tsx` / `Input.tsx` collision (same four exports, different visuals) makes this urgent |

### 2. `docs/audits/ui-audit.md`

- **Per-screen block inventory**, top to bottom, with counts and file paths: `/board` (7 blocks + 4 overlays + 6 chrome), `/board/[id]` (15), `/bytes` (6), `/bank` (5), `/leaderboard` (6), `/profile` (3), `/admin` (4), `/` (8). Add a target column from `01-direction.md`
- **The four-overlay collision** — toast `z-9999`, `MobileBottomNav` `z-9999` (tie), `MeetingPill` `z-9998`, `InstallPrompt` `z-50` and `PushOptIn` `z-40` at identical coordinates (`inset-x-3 bottom-20 sm:right-4`). Nothing coordinates them. Files: `src/hooks/useToast.tsx:52`, `src/components/layout/MeetingPill.tsx:138`, `src/components/pwa/InstallPrompt.tsx:156`, `src/components/pwa/PushOptIn.tsx:110`
- **Redundancy list** — 13 items. "Bank an idea" has 5 entry points with 3 visible at once on `/board`. Topic-detail vote / contrib / comment counts each appear 2-3 times. Meeting countdown twice. Spark buttons twice on `/leaderboard`. Footer duplicated verbatim. `CATEGORY_STYLES` copy-pasted into 3 files
- **Two design systems** — old (`Card` / `Badge` / `Modal` / `Input`, all imported) vs new (`Surface` / `Chip` / `Sheet` / `Field`, 0 importers)
- **Scale drift** — 3 type scales (17 new-scale, 45 alias, ~205 hardcoded pixel sizes); 6 container max-widths across 7 screens; ~8 card treatments for the same object; density tokens consumed by 5 files while every page hardcodes padding; bespoke shadows instead of `elev-1/2/3`; retired `wisteria` / `indigo` still requested by `Badge`, `IdeaCard`, `OutcomesRecap`, `useToast` and rendering as indistinguishable grey
- **Icon chaos** — `lucide-react` plus 4 `react-icons` sets plus inline SVG plus ~25 emoji doing real UI work. The upvote glyph alone is three different things. Include the marketing page's ▲ 🤝 ⚡ feature icons, which are the loudest "internal tool" tell on the only public surface
- **Dead code** — 5 empty (8-byte) component files; 3 orphaned admin API endpoints; `TopicList`'s unreachable empty state; `notification_prefs` table with no settings UI; `/bytes` missing from `MobileBottomNav`
- **Data-fetch fan-out** — `/board` fires 5 independent requests from 4 components, so blocks pop in one by one
- **New section: mobile-first check.** The PWA is the primary client. For each screen, note what is below the fold at 390px width, what is unreachable from `MobileBottomNav`, and which touch targets fall under 44px

---

## Notes for execution

- Write to `docs/audits/`. Leave the working-tree deletion of `docs/redesign-plan.md` alone. Do not restore it, do not stage anything
- Both documents are descriptive, not prescriptive-and-applied. Zero source files change
- Source material is already gathered (commit bodies, per-screen block inventories, design-system findings). No re-exploration needed
- Prose style: match the existing commit bodies. Plain, specific, reasons stated. No em dashes, the repo deliberately removed all 301 of them in `ee28a12`
- Where a claim is checkable, cite `file:line`
- Be honest that every feature is one day old with zero usage evidence. Do not dress hypotheses as validation

## Verification

1. `find docs -type f` lists the expected files and nothing else
2. `git status --porcelain` shows only untracked additions under `docs/` plus the pre-existing deletions. No source file modified
3. Spot-check 5 `file:line` references against the real files
4. Confirm the dead-path claim by hand: grep for callers of `/api/admin/outcome`, `/api/admin/cycle-control`, `/api/admin/carry-forward` and confirm zero hits outside the route files
5. Confirm the submission-window claim by hand: read `isSubmissionAllowed` and establish exactly how many days per cycle the board accepts writes. This is the finding the roadmap's P0 depends on
6. Confirm the 0-importer claim: grep for imports of `Surface`, `Chip`, `Sheet`, `Field`, `Row`, `RowGroup`
7. Read `docs/02-roadmap.md` end to end and confirm every proposed cut traces to a finding in one of the two audits
