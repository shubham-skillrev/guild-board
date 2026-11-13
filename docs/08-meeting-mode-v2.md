# Meeting mode v2

Planned 2026-11-13, after the November meeting. Ship before the December meeting, in 4 batches on main. Each batch is built by a subagent, then a test pass, then pushed.

## What went wrong in November
- Phones said "locked in" and "you can change" on the same poll.
- Results looked different on the screen, the phones and the report.
- Report glitches: a 0% option still showed a sliver of bar, the Problem clinic word cloud was clipped, and one grid cell was left empty.
- The live banner was too quiet, and Kers said "Not invited" while the meeting was live.
- The agenda was written by AI, and the admin could only change it through JSON and a script.
- Boss Round was built for laptops: 6 people tried it out of the 8 who joined.
- An accidental Start followed by End locked the presenter out, and the database had to be reset by hand.

## Batch 1: quick fixes
- **Poll lock:** one tap locks the answer, and the phone says only "Locked in". The answer can't be changed after that.
- **Results:** one renderer, used on the screen, the phones and the report image.
  - Polls show the same tiles as voting. Each tile shows its % in large type with a soft fill to that level, and the winning tile gets a saffron ring.
  - On the phone, the voter's own tile is marked "you picked".
  - Word clouds keep their pastel colours, and phones show the same cloud.
  - The report glitches above are fixed (the 0% sliver, the clipped cloud, the empty cell).
- **Topic slides:** show the author's avatar and @handle, the same way the board card does. Anonymous posters show as @ghost_xxx.
- **Live banner:**
  - A full-width saffron bar that reads "● LIVE · Guild meeting · <current slide> · Join now →". The whole bar is a link, and the dot pulses.
  - The bar is hidden on /meet itself.
  - While live, Kers says "Meeting's on, come in!" and his desk links to /meet.
- **Board card:**
  - Buttons are `Preview slides` and `Start`.
  - Start opens a sheet with two options:
    - Rehearse: a private link, and answers are wiped afterwards.
    - Go live: everyone sees the banner.
  - Go live is pre-selected within 30 minutes of the meeting; Rehearse is pre-selected before that. Nothing runs until the admin presses Start in the sheet.
- **Recovery:**
  - After End, the card shows `Reopen meeting` for 1 hour. It clears ended_at and keeps all answers.
  - If a live start and end had 0 people joining and 0 answers, it resets itself automatically, so the Start button doesn't disappear.

## Batch 2: countdown ring
- Every activity gets a countdown ring:
  - Polls and word clouds: 2:10.
  - Boss Round: 5:00 for the write stage. Each Boss stage has its own time; see Batch 4.
- The ring changes colour from yellow to red near the end. When it reaches zero, the activity closes on its own and the results show.
- The presenter can add 30 seconds or close it early. There's no pause.
- Phones show a small version of the same ring.
- Any slide's time can be changed in the editor.

## Batch 3: slide editor (inside Preview slides)
- **Layout:**
  - A thumbnail rail on the left: drag to reorder, delete, and `+ Add`.
  - The slide preview in the middle.
  - The slide's fields, its timer and the presenter notes on the right.
- **What `+ Add` can add:**
  - Poll or word cloud. A results slide is added automatically after it.
  - Topic from the board. It pulls in the title, description and author.
  - Text or title.
  - Meme, either from Kers' set or an uploaded image.
- **Kers' role:** Kers writes the first draft once, and after that the admin owns the slides. Each slide has an optional "Rewrite with Kers" button, and it never overwrites anything on its own.
- **Saving:**
  - Edits save automatically to the meetings row, with undo for the last 20 changes.
  - "Reset to Kers draft" goes back to his version.
- **Locking:** editing locks on Start. During the meeting the presenter can only skip slides.
- **Built (2026-11-13):** "Edit slides" in Preview slides (or `/meet/present?rehearse=1&edit=1`). Pure logic in `src/lib/meet/agendaEdit.ts` (add, move, delete, undo, lock, activity-row plan); server side in `src/lib/guild/meetingEditor.ts`; UI in `components/meet/SlideEditor.tsx`, previewing with the presenter's own `SlideBody.tsx`. API actions `save_agenda`, `reset_agenda`, `rewrite_slide`, and `POST /api/admin/meeting/meme`. Activity slides carry their poll / cloud in the agenda (`activity`), and saving creates or updates their `meeting_activities` rows. Migration 049 keeps Kers' draft (`agenda_draft`) and adds the `meeting-memes` bucket.

## Batch 4: Boss stages, month recap, extras
- **Boss Round** has three stages. Each is its own activity slide, with its own ring and a reveal after it:
  1. Predict the output, 1:00: four answer tiles.
  2. Fill in the blank, 1:30: tap code chips to fill the gap.
  3. Write it, 5:00: CodeMirror plus tests, on laptops only. Phones show a live count, e.g. "4 coding · 2 passed", and a cheer button.
  - Results are anonymous: % correct per stage, with no leaderboard.
- **Month recap:** when an earlier month is selected on the board, a recap card sits above its discussions. It shows:
  - how many joined,
  - highlights from the polls and word clouds,
  - the Boss Round %,
  - the meeting rating.
  - It can be collapsed, and admins get a button to download the image.
- **Phone as clicker:** the presenter's phone works as a remote for next and previous slide, opening and closing activities, +30s, and the notes. The laptop just shows the slides on the big screen.
- **Live reactions:** phones can send 🔥 😂 👏. They float up on the screen and are rate-limited.
- **Word cloud moderation:**
  - The presenter can tap a word to hide it from the screen.
  - A basic profanity filter.
- **Ask-anything queue:** people send anonymous questions from their phones, and upvotes sort them. The presenter can pull a question onto the screen.

## For the implementing agent

### Code map (read before changing)
- Types, limits, live/done rules: `src/lib/meeting.ts` (Segment, SlideKind, Meeting, meetingLive, meetingDone, cleanAgenda).
- Slide flow: `src/lib/meet/slides.ts` (gotoPlan, navBlocked). Activities: `src/lib/meet/activity.ts`, room state `src/lib/meet/room.ts`, Boss `src/lib/meet/boss.ts` + `bossRunner.ts`, profanity `profanity.ts`, rehearsal `liveRehearsal.ts` + `rehearse.ts`, report `report.ts` / `reportData.ts` / `reportImage.tsx` (next/og).
- UI: `src/components/meet/` — PresenterScreen, ActivityPanel (screen side), PhoneActivity (phone side), MeetRoom (/meet), StartMeetingCard (board card), TopicBody, SegmentCards, tiles, BossEditor (CodeMirror), MemeSlide, PresenterKers, useMeetingLive / useMeetingChannel (realtime).
- Banner: `src/components/layout/MeetingLiveBanner.tsx`. Board Kers: `src/components/kers/`.
- API: `src/app/api/admin/meeting/route.ts` (start/end/goto/open/close/rehearse_*), `.../report(/image)`, `src/app/api/meet/live/route.ts`, `src/app/api/meet/...`.
- DB: migrations 045–049 in `supabase/migrations/`. New ones start at 050.
- Agenda content: `docs/agendas/2026-11.json`, scripts `scripts/apply-agenda.mjs`, `scripts/seed-meeting-activities.mjs`. Standard: `docs/07-*`.

### Rules
- Next.js 16 — check `node_modules/next/dist/docs/` before using framework APIs. `src/proxy.ts`, not middleware.
- New migration columns/tables: code must degrade gracefully when the migration is not applied yet (same pattern as 047's `rehearsalReady`), and say which migration is missing.
- Server is the source of truth for timers: store `closes_at` on the activity; clients render from it; server closes (on read/next request or via the close action) once `now > closes_at`. No client-only timers deciding outcomes.
- UI restraint: one saffron accent per view, 32px/13px control scale, GuildBoard tokens. No big text. Verify by screenshot where possible.
- After any edit to `globals.css`, confirm it still parses (build or postcss).
- Tests: `npm test` (node:test, `src/**/*.test.ts`). Add tests for pure logic. `npx tsc --noEmit` and `npm run lint` clean, `npm run build` passes.
- Work on main. One commit (or a few) per batch, push when green. Commit footer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Don't touch live meeting data in Supabase. Don't apply migrations — list them for the user.

### Acceptance per batch
- **B1:** phone poll never shows change copy; tapping locks; results tiles identical on screen, phone (with "you picked"), and report image; 0% has no bar; report word cloud not clipped, no empty grid cell; topic slides show avatar + @handle (needs author on topic cards — extend card data); saffron banner hidden on /meet, Kers line changes while live; Start sheet with Rehearse/Go live default by time; Reopen within 1h of end; zero-join zero-answer start/end auto-resets (meetingDone false).
- **B2:** `duration_s` per activity slide (default 130 poll/cloud, 300 boss), `closes_at` set on open; ring on screen + phone, yellow→red over last ~20%; +30s and Close now on presenter; auto-close then results slide flow works with navBlocked.
- **B3:** editor inside Preview slides (`/meet/present?rehearse=1` area): rail drag reorder, delete, + Add (poll, word cloud w/ auto results slide, topic from board, text/title, meme from set or upload), right panel fields + timer + notes; autosave debounced to meetings agenda, undo 20, Reset to Kers draft (keep the draft copy), "Rewrite with Kers" per slide (optional, uses existing guildbot provider); read-only once started; new activity slides create their meeting_activities rows (no separate seed script needed).
- **B4:** Boss stages predict/fill/write as three activity kinds with own rings + reveals, phones get watch+cheer during write; recap card on past-month board (collapsible, admin download image); phone clicker for presenter; reactions (rate-limited, floating); word cloud hide-word + profanity filter; ask-anything queue with upvotes and "show on screen".
