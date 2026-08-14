# UI Audit

Written 2026-08-14 against the working tree at `55f9eee`. Companion to `../03-audit-brief.md`. This document gates **U4 (delete-first sweep)** in `../04-technical-plan.md`: section 10 is U4's checklist.

Every count in this document was measured against the tree unless the line says **inherited**, which means it came from the original brief and was not re-counted. Targets in the block tables come from `../01-direction.md`.

---

## 1. Per-screen block inventory

"Block" means a visually distinct region a user has to parse: a header, a card group, a strip, a list, a panel. Overlays and chrome are counted separately because they render on top of every screen.

### Chrome, on every authenticated screen

| # | Block | File | Conditional | CTAs |
|---|---|---|---|---|
| G1 | Username setup modal | `src/components/auth/UsernameSetupModal.tsx` | no username, or `?setup=` | 1 |
| G2 | Sticky header: wordmark, 4-5 nav links, profile pill, logout | `src/app/(main)/layout.tsx:39` | Admin link role-gated | 7-8 |
| G3 | Gradient edge under the header | `src/app/(main)/layout.tsx:69` | no | 0 |
| G4 | Desktop footer | `src/app/(main)/layout.tsx:83` | `hidden md:block` | 0 |
| G5 | Mobile bottom nav, portalled | `src/components/layout/NavLinks.tsx:89` | mobile | 4-5 |
| G6 | Page transition wrapper | `src/app/template.tsx` | reduced-motion off | 0 |

Six chrome pieces before any page content renders.

### `/board` — `src/app/(main)/board/page.tsx`

**7 page blocks. Target: 4.**

| # | Block | Lines | Conditional | CTAs |
|---|---|---|---|---|
| B1 | `PageHeader`, 4-way branching subtitle, action slot | 141-165 | subtitle branches on cycle and phase | 2 |
| B2 | Status strip, 4 `StatTile`s | 170-212 | `isViewingActive && phase !== 'upcoming'` | 1 |
| B3 | `OutcomesRecap`, collapsible | `src/components/board/OutcomesRecap.tsx` | hidden when empty, which today is always (section 7) | 1 + N |
| B4 | `SectionHeader` plus count hint | 220-228 | title flips in archive mode | 0 |
| B5 | Cycle-history chip row, horizontal scroll | 232-252 | `allCycles.length > 1` | N |
| B6 | Five-way body: skeleton, empty, skeleton, empty, `TopicList` | 254-298 | 5 branches | 1 + N x 8 |
| B7 | `BytesTeaser` | `src/components/board/BytesTeaser.tsx` | hidden when no digest | 4 |

Plus `SubmitModal` (306) and `MeetingPill` (314).

`TopicCard` carries roughly 14 pieces of information per row (rank glyph, category chip, up to two more chips, title, two-line description, avatar, handle, comment count, four signal pills, vote count, contrib count) and **8 tap targets**, all nested inside a card that is itself a `<Link>` (`src/components/topics/TopicCard.tsx:226`), with `stopPropagation` holding the arrangement together.

### `/board/[id]` — `src/app/(main)/board/[id]/page.tsx`

**15 blocks. Target: 6.**

| # | Block | Lines | Conditional |
|---|---|---|---|
| T1 | Back link | 299 | no |
| T2 | Badge row | 308-319 | 2 of 3 conditional |
| T3 | Title, edit and delete icon buttons | 358-380 | owner and open phase |
| T4 | Inline delete confirm bar | 383-397 | `confirmDelete` |
| T5 | Delete error bar | 398-402 | `deleteError` |
| T6 | Author line, date, `SparkButton` | 405-423 | spark window |
| T7 | Markdown description | 426-430 | no |
| T8 | `SignalRow`, 4 pills | 433-435 | no |
| T9 | Vote and contrib bar | 440-487 | shown even when disabled |
| T10 | `<h2>Discussion</h2>` | 491 | no |
| T11 | `AskPanel`: heading, remaining count, explainer, chips, search, member list, note field | `src/components/topics/AskPanel.tsx` | no |
| T12 | `CommentThread`: sort bar, composer, N comments x 4 actions | `src/components/topics/CommentThread.tsx` | no |
| T13 | Sidebar: contributors | 507-523 | no |
| T14 | Sidebar: stats (votes, contributors, comments, score) | 526-544 | no |
| T15 | Sidebar: spark budget | 547-560 | spark window |

Edit mode (322-355) swaps T3 through T9 for a sixth distinct form treatment.

### Remaining screens

| Screen | File | Blocks | Target | Note |
|---|---|---|---|---|
| `/bytes` | `src/app/(main)/bytes/page.tsx` | 6 | retires into Feed (U13) | Hand-rolls its own header, skeleton and empty state instead of using `PageHeader`, `CardSkeleton`, `EmptyState` |
| `/bank` | `src/app/(main)/bank/page.tsx` | 5 | becomes a Board tab (U2) | Block K2 (96-102) is a flex wrapper whose only child is conditional, so it usually renders as empty spacing |
| `/leaderboard` | `src/app/(main)/leaderboard/page.tsx` | 6 | folds into You (U8) | 100% bespoke markup. Imports no UI primitive except `UserAvatar` and `SparkButton`. The Hall of Fame block alone contains three separately styled podium cards |
| `/profile` | `src/app/(main)/profile/page.tsx` | 3 | 4, absorbing leaderboard | No `PageHeader`, no `Card`, no `EmptyState` |
| `/admin` | `src/app/(main)/admin/page.tsx` | 4 | out of nav | Uses `text-[11px] uppercase` section headings found nowhere else |
| `/` | `src/app/page.tsx` | 8 | 5 | Duplicate wordmark, duplicate footer, three CTAs to one destination |

---

## 2. The overlay collision

Five fixed-position elements, no shared scale, no coordination.

| Element | z-index | Position | File |
|---|---|---|---|
| Toast stack | `z-[9999]` | `bottom-5 right-5` | `src/hooks/useToast.tsx:51` |
| Mobile bottom nav | `z-9999` | `inset-x-0 bottom-0` | `src/components/layout/NavLinks.tsx:89` |
| `MeetingPill` | `z-9998` | `bottom-20 right-4 md:bottom-6 md:right-6` | `src/components/layout/MeetingPill.tsx:110`, `:127` |
| `InstallPrompt` | `z-50` | `inset-x-3 bottom-20 sm:right-4 sm:bottom-4` | `src/components/pwa/InstallPrompt.tsx:158` |
| `PushOptIn` | `z-40` | `inset-x-3 bottom-20 sm:right-4 sm:bottom-4` | `src/components/pwa/PushOptIn.tsx:110` |
| `Modal` / `Sheet` scrim | `z-50` | `inset-0` | `src/components/ui/Modal.tsx:39`, `src/components/ui/Sheet.tsx:48` |

Three specific defects:

1. **`InstallPrompt` and `PushOptIn` occupy identical coordinates.** Same `inset-x-3 bottom-20`, same `sm:right-4 sm:bottom-4`, same `max-w-sm`. When both are eligible they render on top of each other, and the only thing separating them is `z-50` over `z-40`, so the push prompt is simply hidden behind the install prompt rather than queued behind it.
2. **The toast and the mobile bottom nav tie at 9999.** Ties resolve by DOM order, and both are portalled, so which wins depends on mount order.
3. **Both prompts and `MeetingPill` sit at `bottom-20`**, which is the bottom-nav offset, so on `/board` in the final 48 hours the corner can hold the pill, a prompt and a toast at once.

`Modal` and `Sheet` share `z-50` with `InstallPrompt`, so a prompt can render inside a modal's stacking range.

---

## 3. Redundancy

Thirteen places the same information or action appears more than once.

1. **"Bank an idea" has 5 entry points**, 3 of them visible simultaneously on `/board`: `PageHeader` action (`board/page.tsx:157`), StatTile 4 as a link (`:208`), empty-state action (`:262`), desktop nav "Ideas", mobile nav "Ideas".
2. **"Pitch an idea" twice** on an empty board: header (`:155`) and empty state (`:283`).
3. **Topic-detail counts 2 to 3 times each.** Votes at `board/[id]/page.tsx:461` and `:530`. Contribs at `:484`, `:509`, `:534`. Comments at `:538` and in the thread itself.
4. **Meeting countdown twice.** StatTile 1 (`board/page.tsx:173-190`) and `MeetingPill` (`:314`) both live in the final 48 hours.
5. **Spark buttons twice on `/leaderboard`**: on each podium card, and again for the same three people in the A-Z picker below.
6. **Bytes twice.** `BytesTeaser` fetches `/api/bytes` and renders the same three items that head `/bytes`.
7. **Cycle label up to 6 times on `/board`**: header subtitle, chip row, section header in archive mode, outcomes heading, `MeetingPill`, `BytesTeaser` hint.
8. **Two empty states for one list**: `board/page.tsx:272-286` and `src/components/topics/TopicList.tsx:19-25`. The second is unreachable, because the page branches on `displayTopics.length === 0` before rendering `TopicList`.
9. **Footer duplicated verbatim**: `src/app/(main)/layout.tsx:83` and `src/app/page.tsx:119`, identical markup including the separator span.
10. **`CATEGORY_STYLES` copy-pasted**: `src/components/topics/TopicCard.tsx:15` and `src/app/(main)/board/[id]/page.tsx:30`, plus a third variant `CATEGORY_TONE` at `src/components/bank/IdeaCard.tsx:11`.
11. **Leaderboard scoring rules stated twice**, in the subtitle and again in the footnote.
12. **Wordmark twice** on the landing path, and identity twice in the shell (header pill plus the "You" tab).
13. **Two "Discussion" headings** on topic detail: the page `<h2>` at `:491` and `CommentThread`'s own, suppressed only by an `inline` prop.

---

## 4. Two design systems

Phase 1 shipped the new primitives. Nothing imports them.

| New primitive | Importers | Old equivalent | Importers |
|---|---|---|---|
| `ui/Surface.tsx` | **0** | `ui/Card.tsx` | 1 |
| `ui/Chip.tsx` | **0** | `ui/Badge.tsx` | 3 |
| `ui/Sheet.tsx` | **0** | `ui/Modal.tsx` | 1 |
| `ui/Field.tsx` | **0** | `ui/Input.tsx` | 3 |
| `ui/Section.tsx` `RowGroup` / `Row` | **0** | n/a | n/a |

`Field.tsx` and `Input.tsx` **export the same four names** (`Label`, `Input`, `Textarea`, `CharCount`) with different visuals. Anyone editing a form can import either and get a different result from the same identifier. This is the most urgent single item in the document.

Separately, `SubmitModal`, `UsernameSetupModal` and the topic-detail edit form each hand-roll their own dialog and field markup rather than using any of the eight components above.

---

## 5. Scale drift

| Axis | Measured | Notes |
|---|---|---|
| Type scales in use | **3** | New scale (`text-title-1` etc.) 24 usages; alias scale (`type-display` etc.) 50 usages; hardcoded `text-[Npx]` **204** usages |
| Container widths in `src/app` | **8** | `max-w-sm` 5, `max-w-6xl` 3, `max-w-3xl` 3, `max-w-md` 2, `max-w-7xl` 2, `max-w-5xl` 2, `max-w-xl` 1, `max-w-4xl` 1 |
| Radius values | inherited: `rounded-lg` 71, `rounded-full` 33, `rounded-xl` 30, `rounded-2xl` 14, `rounded-md` 8, token 6, plus `rounded-[1.75rem]` and `rounded-[20px]` | Two tokens exist and are barely used |
| Card treatments for one object | inherited: ~8 | Enumerated in the brief |
| Density tokens | consumed by 5 files | `--pad-card`, `--gap-list`, `--gap-section`, `--radius-card`, `--control-h` are defined with a 768px shift in `src/app/globals.css`, and every page hardcodes `px-5 md:px-10 py-8` instead |

The brief recorded 45 alias usages and 17 new-scale usages. Both have grown (50 and 24). Drift is moving in the wrong direction, which strengthens the case for doing U6 in one pass rather than incrementally.

Bespoke shadows are used instead of `elev-1/2/3` throughout, and the retired `wisteria` and `indigo` tokens are still requested by `Badge`, `IdeaCard`, `OutcomesRecap` and `useToast`. Since phase 0 remapped both to neutral, those components now render grey, and `useToast`'s `info` variant is not visually distinct at all.

---

## 6. Icons

Five `react-icons` sets across 13 import sites: `io5` 5, `fi` 3, `bi` 2, `fa6` 2, `lu` 1. Plus `lucide-react` in 8 files, plus raw inline `<svg>` in `Modal.tsx`, `OutcomesRecap.tsx` and `login/page.tsx`, plus roughly 25 emoji doing real UI work (inherited count).

`src/components/ui/Icon.tsx` exists specifically to fix this and is used by 8 files.

**The upvote glyph is three different things:**

- `BiUpvote` / `BiSolidUpvote` in `TopicCard.tsx:9` and `board/[id]/page.tsx:15`
- Lucide `ArrowBigUp` in `board/page.tsx:192`
- The literal character `▲` in `profile/page.tsx:98`, `ByteCard.tsx:101`, `AdminControls.tsx:355`, `ByteGenerator.tsx:204`, and as a feature icon on the marketing page at `src/app/page.tsx:60`

The last one matters most: `▲ 🤝 ⚡` as the three feature icons on `/` is the loudest "internal tool" signal on the only public surface.

---

## 7. Dead code and dead paths

**Empty files, 8 bytes each, containing only a TODO comment:**

- `src/components/admin/AdminTopicRow.tsx`
- `src/components/admin/CycleControls.tsx`
- `src/components/admin/OutcomeTagger.tsx`
- `src/components/layout/Navbar.tsx`
- `src/components/layout/Footer.tsx`

The last two are notable because `(main)/layout.tsx` inlines its own header and footer rather than using them.

**Three admin endpoints with zero UI callers.** Verified by grep across every `.ts` and `.tsx` outside `src/app/api/`:

- `PATCH /api/admin/cycle-control` - 0 callers
- `PATCH /api/admin/outcome` - 0 callers
- `POST /api/admin/carry-forward` - 0 callers

**This is a dead path, not just dead code.** Without cycle-control there is no way to move a cycle to `frozen` or `closed`. `/api/outcomes` requires `status in ('closed','frozen')`, so it always returns `{cycle: null}`, so `OutcomesRecap` can never render, so block B3 on `/board` and the "taken forward" stat on `/leaderboard` are permanently empty. Phase transitions today depend entirely on `meeting_at` passing (`src/lib/utils/cycle.ts:7`).

**Other dead or orphaned items:**

- `TopicList`'s empty state (`src/components/topics/TopicList.tsx:19-25`) is unreachable
- `notification_prefs` (migration 008) is read at send time in `src/lib/push/notify.ts` and has no settings UI
- `PushToggleButton` is exported from `src/components/pwa/PushOptIn.tsx` and never rendered
- `/bytes` is absent from `MobileBottomNav` (`src/components/layout/NavLinks.tsx:89-120`, four items: Board, Ideas, Leaders, plus Admin and You), so on the primary client it is reachable only through `BytesTeaser`
- `src/app/(main)/admin/page.tsx:3` imports `CATEGORY_LABELS` and `OUTCOME_LABELS` and defines `MONTHS`, none used
- `src/app/api/cycles/route.ts` supports an `x-admin` header path no client sends

---

## 8. Data-fetch fan-out

`/board` issues five independent reads on mount from four components:

| Endpoint | Caller |
|---|---|
| `/api/cycles` | `src/hooks/useCurrentCycle.ts:23` |
| `/api/cycles?all=true` | `src/app/(main)/board/page.tsx:51` |
| `/api/topics` | `useTopics`, plus a second archive fetch at `board/page.tsx:66` |
| `/api/outcomes` | `src/components/board/OutcomesRecap.tsx:42` |
| `/api/bytes` | `src/components/board/BytesTeaser.tsx:25` |

Each renders its own skeleton or nothing, so the page assembles itself in front of the user, block by block, in nondeterministic order. `useTopics` also runs a 15s poll (`src/hooks/useTopics.ts:19`) alongside a realtime subscription, which is a third mechanism doing a job two already do. A4 and A2 in the technical plan address this.

---

## 9. Mobile-first check

The PWA is the primary client. `manifest.json` is `display: standalone`, `orientation: portrait` (`src/app/manifest.ts:11-12`).

**Touch targets under 44px.** `globals.css:93` sets `--control-h: 44px` on mobile and comments that touch needs a bigger target than a pointer, but only five files consume the token.

- **`SignalRow` pills fail hardest.** `src/components/topics/SignalRow.tsx:97` renders `px-2 py-0.5 text-[11px]` in compact mode and `px-2.5 py-1 text-[12px]` otherwise, which computes to roughly 20px and 25px of height. These are four of the eight tap targets on a topic card, they sit inside a card that is itself a link, and they are half the minimum size.
- Category and status chips use `px-2 py-0.5` (`TopicCard.tsx:121`, `:126`, `:129`). Non-interactive, so they pass, but they set the visual rhythm the interactive pills copy.
- The bottom nav is borderline: `py-1.5` around an 18px icon and 11px label lands near 47px including padding. It correctly applies `pb-[env(safe-area-inset-bottom)]` (`NavLinks.tsx:89`).

**Reachability.** `/bytes` has no bottom-nav entry, so a feature with five API routes, three tables and a weekly cron is unreachable on the primary client except through a teaser card on one screen.

**Below the fold at 390px.** Not measured in a browser. On `/board` the ordering alone puts the topic list, the reason for the screen, beneath a header, a 4-tile strip, a collapsible recap, a section header and a scrolling chip row. On `/board/[id]` the comment thread sits below 11 blocks, and the sidebar cards (T13 to T15) stack underneath everything on a phone, so the stats card, which duplicates numbers already shown, occupies prime scroll depth.

---

## 10. U4 deletion checklist

Pure removals. No restructuring, no new components, no design decisions. This is the executable output of this document.

**Files to delete**

- [ ] `src/components/admin/AdminTopicRow.tsx`
- [ ] `src/components/admin/CycleControls.tsx`
- [ ] `src/components/admin/OutcomeTagger.tsx`
- [ ] `src/components/layout/Navbar.tsx`
- [ ] `src/components/layout/Footer.tsx`
- [ ] `src/components/board/BytesTeaser.tsx` and its usage at `board/page.tsx:302`
- [ ] `src/components/admin/ByteGenerator.tsx` curation panel, keeping generation

**Code to delete**

- [ ] `TopicList`'s unreachable empty state (`TopicList.tsx:19-25`)
- [ ] `PushToggleButton` export (`PushOptIn.tsx`)
- [ ] Unused imports and the `MONTHS` constant in `admin/page.tsx:3-9`
- [ ] The `x-admin` header path in `api/cycles/route.ts`
- [ ] The leaderboard podium block, keeping sparks and the A-Z picker
- [ ] The duplicate spark buttons on the podium (subsumed by the above)
- [ ] The topic-detail stats sidebar card (T14, `board/[id]/page.tsx:526-544`), every number in it appears elsewhere on the same screen
- [ ] The duplicate `<h2>Discussion</h2>` at `board/[id]/page.tsx:491`
- [ ] The empty flex wrapper at `bank/page.tsx:96-102`
- [ ] `SignalRow` from `TopicCard` (keep it on detail, trimmed to 2 signals in U8)

**Duplicate entry points to collapse**

- [ ] "Bank an idea" from 5 to 1
- [ ] "Pitch an idea" from 2 to 1 on an empty board
- [ ] Meeting countdown from 2 to 1 (delete StatTile 1, keep `MeetingPill` until the cycle indicator replaces both in U6)
- [ ] Footer defined once and imported, not duplicated between `page.tsx:119` and `layout.tsx:83`
- [ ] `CATEGORY_STYLES` defined once in `src/lib/constants.ts`, not three times

**Decisions that are not deletions** and belong to later units: which two signals survive (U8), what replaces the status strip (U6 cycle indicator), whether `/bytes` gets a nav slot or retires into the Feed (U13). Do not resolve them here.

**Not deletable yet.** The three orphaned admin endpoints stay. U3 wires them, and deleting them first would delete the fix for the dead outcomes path.

---

## What this audit does not cover

Feature-level keep, cut and defer decisions live in `../03-audit-brief.md` and are not repeated here. `docs/audits/feature-audit.md`, the per-feature record with rationale and cost, remains unwritten and gates nothing.
