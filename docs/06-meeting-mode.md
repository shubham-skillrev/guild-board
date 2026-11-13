# 06. Meeting Mode

The guild meeting, run from GuildBoard. The admin shares a full-screen
presenter view; everyone else joins from the site on a laptop or phone and
takes part without having to speak: an opinion poll, a word cloud, and at the
end Kers' Boss Round, where Kers dares the humans to write code.

**Why:** meetings are fully remote and most attendees listen but don't speak.
A tap is cheaper than unmuting. Results land on the shared screen, so a tap
counts, and the admin can turn it into talk ("40% said bubble, anyone want to
defend that?").

Planned 2026-11-12 (grill session). Progress is tracked at the bottom.

---

## Decisions

| Area | Decision |
|---|---|
| Phasing | P1 presenter screen → P2 audience (poll, word cloud) → P3 Boss Round |
| Who runs it | `admin` only: starts meeting mode, edits Kers' drafts in the Run tab, moves slides. No "lead" or "organiser" role |
| One presenter | The admin who starts meeting mode is the presenter (`meetings.presenter_id`). Only they move slides (which opens and closes activities). Another admin opening `/meet/present` gets it read-only, with "Take over" for when the presenter drops off the call |
| Admins take part too | Every admin, the presenter included, joins `/meet` like any member and votes, types words and plays the Boss Round. Their answers count the same and are just as anonymous. The presenter uses their phone or a second tab, so the shared screen stays clean |
| Setting | Fully remote. Attendees on laptops or phones |
| Scale | ~20 now, 60 max. Stress-tested at 60 before the first real meeting |
| How people join | A banner on the website while the meeting is live. No link in the call chat, QR code or short code |
| Members | Join under their account |
| Guests | Type a name, then the waiting area. Name stored, never shown on screen |
| Activities | Opinion poll and word cloud only. No quiz, no submitted questions |
| On screen | Everything is anonymous. Counts, words and pass rates; never names |
| Poll reveal | Counts hidden on the presenter screen for the first 8 s after it opens, then live |
| Moderation | Server-side profanity filter only. No manual hide |
| Activity choice | Designed into the agenda: each poll, word cloud or Boss Round is its own slide, seeded from the month's agenda file. No admin UI to choose or reorder them |
| Kers' prep | Talking points + one opener per slide, generated before the meeting, editable by admins in the Run tab. No AI calls during the meeting |
| "Who to ask" | Members who voted or commented on a segment's topic. Stored in the DB only, shown nowhere |
| Boss Round code | Runs in the attendee's own browser (Web Worker, timeout). Only pass/fail is sent |
| Boss Round editor | One plain editor, the same on phone and laptop |
| Boss Round problems | A fixed list we write. Kers does not draft them |
| Boss Round line | "You lot tell me what to write all day. Let's see if you can still code." |
| Pace | No timers anywhere (decided 2026-11-12, the day before the first run). The presenter finishes each slide or skips it. No countdown, no overtime, no "one minute left" nudges; the Boss Round has no clock either. Slides carry `minutes: 0` |
| Presenter screen | Slides (decided 2026-11-12 evening): the agenda is a flat list of slides grouped into sections, as many as the flow needs. One idea per slide, few words, generous whitespace. Progress is one thin line with a dot per slide, grouped by section, no text. Kers is small, in the corner, and speaks only now and then |
| Spotlight / Demo | Not in meeting mode: the guild has no Spotlight or Demo running yet. Show & Tell is not a section; a volunteer may share a trick for two minutes (the presenter's notes say when), and the Wrap asks for one desk-tour volunteer for next month |

---

## Slides

The agenda is a flat, ordered list of **slides** (`lib/meeting.ts`
`Segment`, with `slide` set). Consecutive slides with the same `section`
form a section: the progress line groups them, the Slack agenda lists them.
How to write a month's slides: [07-agenda-and-script-guide.md](./07-agenda-and-script-guide.md).

| Slide | Shared screen | Phone |
|---|---|---|
| `title` | "Next up": the section's title and one cue line, Kers bouncing | The cue |
| `content` | Real cards (board posts with the board's own `TopicCard`, Radar news) and/or plain text: a debate's sides in two columns, notes as a compact list | The same cards, tap to open (new tab) |
| `activity` | The poll, word cloud or Boss Round, live. A prominent state ("Voting open · 12 of 20") and the one saffron action, **Close voting → results** | The input: poll tiles, word box, Boss editor |
| `results` | The activity's results, big (its `of`), and one line to talk about | The results |
| `text` | One big statement or question | The statement |
| `meme` | A Kers meme (one or two panels, Kers with a face, a label and a line, an optional punchline) or an image from `public/meet/memes/` | The same, with a small entrance |

**Activities drive themselves** (server-side, presenter only, `goto` in
`/api/admin/meeting`, logic in `lib/meet/slides.ts` `gotoPlan`):
- Arriving on an activity slide opens its activity, if it has never opened
  (`ready`). One that was closed stays closed (going back doesn't reopen it
  by accident); the presenter has **Reopen**.
- Leaving it closes it: every open activity closes on `goto`, except the
  target slide's own.
- **Close voting → results** moves to the next slide when it is this
  activity's results slide (which closes it), else closes in place.
- **While it's open the slide is locked**: ← →, the arrows and the dots do
  nothing, and the screen says "Close voting to move on". The server refuses
  any other `goto` from it with a 409 (lib/meet/slides.ts `navBlocked`), in
  a live rehearsal too; the local preview enforces the same. Only Close
  voting's own move to the results slide goes through. Leaving an open
  activity used to close it behind the phones' backs, and coming back left
  it closed until Reopen.
- Starting meeting mode on an activity slide opens it too.
- Topic slides (a content slide whose only card is one board post) show the
  post's title and its whole description as markdown, fetched at render.
- The first slide shows a QR to join (`/meet`, or the rehearsal link); the
  last slide a QR to `/survey` (phones get a button).
- The poll's counts stay hidden for the first 8 s after it opens.

**Kahoot touches, without timers or names:** poll options are big pastel
tiles with a shape each (triangle, diamond, circle, square), the same on the
screen and the phone, so people match screen to phone; a tap shows "Locked
in!" with Kers' reaction; the "N answered" count ticks up; on a results
slide the bars rise one by one after a short drumroll and the winner pops;
title slides are a "Next up" moment with Kers. No leaderboard, no
countdowns, nothing named. All of it stills under reduced motion.

**No migration:** activities stay in `meeting_activities`, keyed by the
activity slide's id in `segment_id`. `UNIQUE(cycle_id, segment_id)` means
one activity per slide, which is the model. A results slide finds its
activity through `of` (`activityKeyFor`).

**Old agendas** (segments without `slide`) still render: each segment is one
slide, an `activity` slide if it has an activity, else `content`
(`slideKind`).

November's flow (25 slides, 7 sections) is in
[agendas/2026-11.md](./agendas/2026-11.md).

---

## Rehearsal

Two ways to practise, both from the board card, the presenter screen's start
screen and the Run tab:

| | Preview alone | Rehearse live (with phones) |
|---|---|---|
| What | `/meet/present?rehearse=1`, this browser only | The real pipeline: join, answers, the broadcast, slides opening and closing activities, results |
| Answers | Samples, plus the `M` phone preview | Real phones: the admin's own and a few people's |
| Writes | Nothing | Rehearsal data, wiped at the end |
| Needs | Nothing | Migration 047 |

**Live rehearsal** (`lib/meet/liveRehearsal.ts`, `rehearse_start` /
`rehearse_end` in `/api/admin/meeting`, migration 047):
- **Private.** It never sets `started_at`, so the meeting isn't live: no
  banner, `/api/meet/live` says no, `meetingLive` and `meetingDone` don't
  change. `/meet` opens only to whoever holds the code: the share link is
  `/meet?r=<code>` (24 random bytes, stored in `meetings.rehearsal_code`).
  The proxy moves the code into the httpOnly `gb_meet_r` cookie (12 h) and
  drops it from the address bar. Anyone with the link joins: members under
  their account, guests by name. Without it, /meet is shut as on any other
  day ("There's no meeting on right now", the same 409 for a wrong code).
- **Marked.** The presenter screen says **Rehearsal** in the header and shows
  a strip with the link to share (plain text, **Copy link**; no QR) under
  it; phones say "Rehearsal · answers are deleted afterwards". The
  presenter's own phone gets their notes, as live.
- **Same flow.** The presenter lock, `goto`, the activities opening and
  closing, Close voting and Reopen all work as live. Run-tab notes are
  refused while it runs (they'd reach the recap).
- **Disposable.** **End rehearsal** (header, or the last slide), and also the
  real **Start**, wipe: every `meeting_participants` row of the month (their
  answers cascade), every activity back to `ready` (`opened_at` /
  `closed_at` null), `presenter_id`, `current_segment`,
  `segment_started_at`, `started_at` / `ended_at` (only ever a dry run's
  here) and the code, so the link stops working. Phones fall back to "No
  meeting on". Nothing reaches the recap or participation counts.
- **Can't collide.** It can't start while the meeting is live or once it has
  run this month (started inside the 3 h before it); the wipe would take
  real answers with it. Starting the real meeting while one is on asks
  first ("A rehearsal is still on. Starting the meeting ends it and deletes
  its answers."), then ends and wipes it before going live. If the meeting
  were somehow live already, only the code is dropped (`rehearsalWipeMode`).
  End during a rehearsal is End rehearsal: it never sets `ended_at`.
- A rehearsal left running stops counting after 8 h; its leftovers are wiped
  by the real Start (or the next rehearsal).
- Realtime: the same `meeting:{id}` channel. The room carries `rehearsal:
  true` and `live: false`, so a phone without the code that's sitting on
  /meet stays shut.

**Running it the evening before**
1. Board card (or `/meet/present`) → **Rehearse live (with phones)**. The
   presenter screen opens on the first slide, marked Rehearsal.
2. **Copy link** from the strip and send it to the people helping. Open it on
   your own phone too (signed in, for your notes).
3. Present as on the day: ← →, Close voting, results.
4. **End rehearsal**. Everything they answered is deleted.

**Stress test inside a rehearsal** (production, no banner):
`node --env-file=.env.local scripts/meet-stress.mjs --base https://guildboard.skillrev.in --rehearsal <code> --n 60`
with the code from the link. The script's production guard lets it through
only with `--rehearsal` (and refuses `--start`): it never makes the meeting
live, it removes its own guests and stress activities, and End rehearsal
wipes whatever is left (including the real activity a stress activity closed).

---

## Phase 1: Presenter mode

**Entry**
- From the day before (24 h, `MEET_REHEARSE_MS`), admins see a glowing
  meeting card at the top of the board, with Kers, and three actions:
  **Preview alone**, **Rehearse live (with phones)** (see "Rehearsal" below)
  and **Start meeting**.
- **Preview alone** (was "Rehearse") opens `/meet/present?rehearse=1`: the full presenter screen on
  the real agenda, prep and seeded activities. Nothing goes live: no
  `started_at`, no presenter, no banner, no write to the API. Segments move
  locally; arriving on an activity slide "opens" it with sample answers over
  ~25 s (`lib/meet/rehearse.ts`), so the poll reveal, the cloud and the Boss
  Round can be practised, and the results slide after it shows them. `M` shows a phone preview beside it (the real `/meet`
  room, offline, as the presenter's own phone: cards and notes) whose
  answers land on the screen. Also linked from the Run
  tab (agenda builder and Meeting mode).
- **Start meeting** marks the meeting live (`meetings.started_at`). Members
  and guests then see the "Meeting is live, join the room" banner on the
  site. More than 3 h before the meeting (`MEET_LEAD_MS`) it asks first ("The
  meeting is tomorrow at 11:00. Start it now? Everyone will see the live
  banner."), on the board card, the presenter screen and the Run tab. Start
  stays admin-only on the server.

**Presenter screen** (`/meet/present`, full screen, admin only)
- No clock. The presenter finishes each slide or skips it.
- One slide at a time, laid out by its kind (see "Slides" above): minimal,
  generous whitespace, smaller copy. Real content as cards, summaries as
  plain text. One saffron action per view.
- The presenter's notes (opener and talking points) are **never** on the
  shared screen: they go to the presenter's own phone (below). In Rehearse
  they show at the bottom (`P` hides them).
- Progress: one thin line with a dot per slide, grouped by section, no
  labels. The current dot is larger; the presenter can click a dot to jump.
- ← / → (PageUp / PageDown for a clicker) move slides; subtle arrows sit at
  either end of the line. Esc leaves, F goes full screen. A refresh resumes in place.
- Kers, small, at the end of the line: a speech bubble now and then (a cheer
  when the presenter moves on, the Boss Round dare), never about time.
- Everything fits 1920 × 1080 with no scrolling, light and dark. The room
  shows as anonymous avatar seeds (never names).
- The posts are read server-side (`meetPosts` in `lib/guild/meetingPrep.ts`)
  for the presenter and for every phone.

**Kers' prep** (the standard and prompts: [07-agenda-and-script-guide.md](./07-agenda-and-script-guide.md))
- Drafted per slide (memes have none) from its posts (post, comments, votes)
  when the agenda is locked, or 3 h before at the latest.
- Admins edit it in the Run tab. If drafting fails, the slide has no notes.
- "Who to ask" is computed and stored with the prep. Not rendered.

**Data**
- Each agenda item gains `prep: { points: string[], opener: string, ask: uuid[] }`.
- `meetings` gains `presenter_id`, `current_segment` and `segment_started_at`. `started_at` /
  `ended_at` already exist.

---

## Phase 2: The audience

**Joining**
- The banner opens `/meet`. Members go straight in.
- Guests type a name and get a meeting-scoped token in a cookie. No account.
- Joining only works while the meeting is live (or in a live rehearsal, with its link: see "Rehearsal").
- The waiting area shows "Kers is setting up…" and how many people are in.
- The phone mirrors the current slide (see "Slides"): the same cards (news
  opens its source, a post its board page, both in a new tab), the open
  activity's input, the results, the cue or the meme. "Kers is setting up…"
  only shows with no agenda.
- **The presenter's own phone** (signed in as the one presenting) also
  shows **Your notes**: the opener and talking points for the current slide.
  `GET /api/meet` sends them only when the session's user is
  `meetings.presenter_id` (`phoneAgenda` in `lib/meeting.ts`); everyone else
  gets the agenda without prep, and the broadcast (`RoomState`) never
  carries the agenda at all. Tested in `lib/meeting.test.ts`.

**Opinion poll**
- 2–4 options. One vote each; it can be changed until the poll closes.
- The presenter screen shows the bars after the first 8 s, then live.

**Word cloud**
- Up to 3 words per person, 20 characters each, lower-cased and merged.
- Words grow with how many people typed them. Live from the start.

**Profanity filter**
- Runs on the server before anything is stored or broadcast.
- English, plus common Hindi and Hinglish slang.
- Normalises leetspeak, separators and repeated letters ("f.u.c.k", "b00b", "shiiit").
- A blocked word is dropped quietly. The sender sees "Kers didn't like that one".

**Realtime**
- A private broadcast channel `meeting:{id}`, which members and guests can listen to (extends migration 030).
- Answers go to the API. The server aggregates and broadcasts at most once a
  second, never once per answer (60 × 60 fan-out otherwise).
- If the channel fails, the screen polls every 3 s.

**Data**
- `meeting_participants`: meeting, user_id or guest name + token hash, joined_at.
- `meeting_activities`: meeting, slide id (`segment_id`), kind (`poll` / `cloud` / `boss`),
  prompt, options, status (`ready` / `open` / `closed`), opened_at, closed_at.
- `meeting_responses`: activity, participant, value. Unique per participant for polls.
- A month's activities are seeded into `meeting_activities` from its agenda file by a script, not through any UI.

**Stress test** (gates the first real meeting)
- A script opens 60 fake participants against a preview deploy. All 60 join,
  all vote within 5 s, then all send 3 words.
- Pass: the presenter screen catches up within 2 s, no lost or doubled
  answers, no API errors.

---

## Phase 3: Kers' Boss Round

**Flow**
1. The presenter reaches the Boss Round's activity slide, which opens it. Kers: *"You lot tell me what to
   write all day. Let's see if you can still code."*
2. Each participant gets the problem, a function signature and a plain
   editor. No countdown: the round runs until the presenter closes it (or
   moves on, which closes it).
3. "Run tests" runs the code in a Web Worker in their own browser, with 2 s
   per test. On a timeout the worker is killed (no infinite loops).
4. Only the result is sent: passed, and tests passed of total. Never the code.
5. The presenter screen shows the % who passed all tests and how many are
   trying. No names.
6. Once the round is closed, Kers gives a verdict by pass rate ("62% of
   you can still code. I'm mildly impressed."), with a small burst on screen
   when it's 50% or more.

**Cheating:** someone could fake a pass. That's accepted: no names, no prizes.

**Problem list** (fixed, very easy JavaScript)

| # | Problem | Signature | Test cases |
|---|---|---|---|
| 1 | Sum of the even numbers | `sumEvens(nums)` | `[1,2,3,4]→6`, `[]→0`, `[1,3]→0`, `[-2,5,8]→6`, `[0]→0`, `[10]→10` |
| 2 | Reverse each word, keep the word order | `reverseWords(s)` | `"hello world"→"olleh dlrow"`, `""→""`, `"a"→"a"`, `"ab cd ef"→"ba dc fe"` |
| 3 | Is it a palindrome? (ignore case and spaces) | `isPalindrome(s)` | `"Racecar"→true`, `"nurses run"→true`, `"hello"→false`, `""→true`, `"ab"→false` |

---

## After the meeting
- Poll splits, the top words and the Boss Round pass rate go into the data Kers drafts the recap from.
- Participation counts feed the admin dashboard, anonymised like the existing activity levels.
- Guest tokens expire when the meeting ends.

---

## Progress

### Planning
- [x] Grill: scope, phasing, roles, joining, activities, moderation, Boss Round (2026-11-12)
- [x] First-run agenda and activity placement
- [x] Boss Round problem list
- [ ] Choose the target meeting for P1, and for P2 + P3

### Phase 1: Presenter mode
- [x] Migration: `meetings.presenter_id`, `current_segment`, `segment_started_at`; `prep` on agenda items
- [x] Presenter lock: read-only `/meet/present` for other admins, "Take over"
- [x] Kers prep generation (points, opener, "who to ask") and its trigger
- [x] Run tab: edit Kers' prep per segment
- [x] "Start meeting mode" card on the board (admins, from 3 h before)
- [x] `/meet/present`: segment view, progress line, keyboard nav, resume (countdown and overtime removed 2026-11-12)
- [x] Kers reactions on the presenter screen
- [x] Rehearse from the day before (`?rehearse=1`, phone preview); Start asks first when > 3 h early
- [x] Live rehearsal (2026-11-12 night): the real pipeline with phones, private link `/meet?r=<code>`, no banner, wiped on End rehearsal or the real Start (migration 047, `lib/meet/liveRehearsal.ts`, tests in `liveRehearsal.test.ts`); "Rehearse" is now "Preview alone"
- [ ] Apply migration 047, then rehearse live with a few phones
- [x] Slides (2026-11-12 evening): sections of slides, activity slides open and close themselves on `goto`, results slides, memes, Kahoot-style tiles; Spotlight and Demo out
- [ ] Screenshot check on a 1080p share

Built (2026-11-12): migration `045_meeting_presenter.sql`; `/meet/present`
(`components/meet/PresenterScreen.tsx`); prep in `lib/guild/meetingPrep.ts`.
"Agenda locked" = posted to Slack from the Run tab. Prep is also drafted by
the day-before cron (`/api/cron/meeting-reminder`) and, at the latest, when an
admin's board loads inside the 3 h before; each pass fills only segments with
none, never an admin's edit. Segments link to board posts (`topicIds`), set
by "Build from the board" or by hand in the Run tab. Admin screens poll every
3 s for now (`components/meet/useMeetingLive.ts`); Phase 2 adds the
`meeting:{id}` channel there and renders its activity in
`components/meet/ActivityPanel.tsx`.

### Phase 2: Audience
- [x] Migration: `meeting_participants`, `meeting_activities`, `meeting_responses`; realtime policy for `meeting:{id}`
- [x] "Meeting is live" banner on the site
- [x] `/meet`: member join, guest name + token, waiting area
- [x] Poll: phone vote, presenter bars with the 8 s delay
- [x] Word cloud: phone input, presenter cloud
- [x] Profanity filter + tests (English, Hinglish, leetspeak)
- [x] Throttled aggregate broadcast (≤ 1/s) + polling fallback
- [x] Seed script for the first run's activities
- [ ] Stress test at 60 participants: **must pass before the first live use**

Built (2026-11-12): migration `046_meeting_audience.sql`; `/meet`
(`components/meet/MeetRoom.tsx`, `PhoneActivity.tsx`) and `/api/meet`;
activities, answers and the room in `lib/meet/` (`activity.ts` shapes and
aggregation, `room.ts` server side, `profanity.ts`); the presenter's panel in
`components/meet/ActivityPanel.tsx`; the banner in
`components/layout/MeetingLiveBanner.tsx`. Unit tests: `npm test`.

- **Meeting id** = the month's `cycle_id` (`meetings` is keyed by it), so the
  channel is `meeting:{cycle_id}`.
- **Guests and the channel:** the payload is exactly what the shared screen
  shows (a participant count, counts or words; never a name or who answered
  what), so `anon` may listen like on `board:*` (030). A /meet guest's
  browser joins with the publishable key. Their identity for writes is the
  httpOnly `gb_meet` cookie, checked by `/api/meet`; only its SHA-256 is
  stored, and it's cleared when the meeting ends.
- **Throttle:** every answer "nudges" the room after its response;
  `meeting_live_claim()` in the database decides atomically: send now (the
  last send was ≥ 1 s ago), own the trailing flush (wait, then send what's
  stored by then), or do nothing (a flush is already waiting). So a burst
  sends one broadcast a second, the last answers land within ~1 s, and
  serverless needs no shared timer. Clients that miss one pull the same
  room on their poll (3 s without the channel, 15–30 s with it).
- **Seed:** `node --env-file=.env.local scripts/seed-meeting-activities.mjs --from docs/agendas/YYYY-MM.json`
  seeds each activity onto its activity slide by id. Without `--from` it
  seeds the first-run list onto the first activity slide of each kind, so
  "Build from the board" (which drafts the format as slides) works too.
- **Stress test:** `scripts/meet-stress.mjs --base <preview>` (needs the
  preview's service-role key; see the script's header), or against
  production inside a live rehearsal with `--rehearsal <code>` (see
  "Rehearsal"). Not run yet.
- Activities open and close with their slides; ending the meeting closes any still open. A live
  meeting nobody ended stops counting as live after 8 h.

### Phase 3: Boss Round
- [x] Problem list in code, with tests
- [x] Phone/laptop editor + Web Worker runner with per-test timeout
- [x] Pass-rate tally on the presenter screen
- [x] Kers' intro and verdict lines
- [ ] Try it on a real phone and laptop (editor at 360 px, a runaway loop, a syntax error)

Built (2026-11-12): problems, the worker's source, judging and Kers' lines in
`lib/meet/boss.ts` (tests: `boss.test.ts`, which runs the reference and
wrong solutions through the worker's source); the runner in
`lib/meet/bossRunner.ts`; the phone in `PhoneActivity.tsx` (`PhoneBoss`);
the presenter's tally in `ActivityPanel.tsx` and Kers in `PresenterKers.tsx`.

- **Runner:** one worker from a Blob URL per run, one test at a time. A test
  that doesn't answer in 2 s gets its worker `terminate()`d and is marked
  timed out; a fresh worker takes the rest. A syntax error or a missing
  function fails the run at once and is shown. Results are compared on the
  page with a deep equality.
- **Sent:** `{ passed, tests, of }` at slot 0, so each run replaces the last.
  The server checks `of` against the problem and that `passed` means all.
  Runs are taken until the round is closed (a closed activity refuses them).
- **Presenter:** the % of those trying who passed every test (floored, so
  100% means everyone; "–" until someone has passed), how many are trying.
  No clock. Kers says the line for the first 20 s; the verdict shows on the
  stage once the presenter closes the round.
- The editor keeps its code in the browser's `localStorage` per activity, so
  a refresh doesn't lose it. Tab indents; Esc then Tab leaves the editor.
- The editor is CodeMirror 6 (`components/meet/BossEditor.tsx`): JavaScript
  highlighting in the guild's soft token colours, line numbers, wrapping,
  closing brackets. Loaded only when a Boss Round is on screen (a plain
  textarea until then, or if it fails). 16 px on touch, no autocorrect.
  Read-only once the round is closed.

### After the meeting
- [ ] Activity results into the recap draft
- [ ] Participation counts in the admin dashboard
