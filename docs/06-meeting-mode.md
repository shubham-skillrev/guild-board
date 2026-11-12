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
| Who runs it | `admin` only: starts meeting mode, edits Kers' drafts in the Run tab, moves segments, opens activities. No "lead" or "organiser" role |
| One presenter | The admin who starts meeting mode is the presenter (`meetings.presenter_id`). Only they move segments and open activities. Another admin opening `/meet/present` gets it read-only, with "Take over" for when the presenter drops off the call |
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
| Activity choice | Hard-coded for the first run (below). No admin UI to choose or reorder them |
| Kers' prep | Talking points + one opener per segment, generated before the meeting, editable by admins in the Run tab. No AI calls during the meeting |
| "Who to ask" | Members who voted or commented on a segment's topic. Stored in the DB only, shown nowhere |
| Boss Round code | Runs in the attendee's own browser (Web Worker, timeout). Only pass/fail is sent |
| Boss Round editor | One plain editor, the same on phone and laptop |
| Boss Round problems | A fixed list we write. Kers does not draft them |
| Boss Round line | "You lot tell me what to write all day. Let's see if you can still code." |
| Pace | No timers anywhere (decided 2026-11-12, the day before the first run). The presenter finishes each item or skips it. No segment countdown, no overtime, no "one minute left" nudges; the Boss Round has no clock either. Segment `minutes` stay in the data for drafting the agenda only |
| Presenter screen | Minimal: the activity is the hero when there is one (poll bars, word cloud, Boss pass rate); otherwise the segment title and Kers' opener, large. Progress is one thin line with a dot per segment, evenly spaced, no text. Kers is small, in the corner, and speaks only now and then |

---

## First-run agenda (60 min)

Rebuilt from the November agenda. Trimmed to make room for the warm-up and
the Boss Round. The minutes are a planning guide only: nothing on screen
counts them, and the presenter moves on when an item is done.

| # | Segment | Min | Activity | Why there |
|---|---|---|---|---|
| 1 | **Warm-up** (Kers) | 2 | Word cloud: *"One word for your week so far"* | Everyone joins and taps once before anything serious. Tests the room while the stakes are zero |
| 2 | **Radar**: eMudhra intermediate CA compromise · KV-cache exposure in the GLM-5.3 Worker | 5 | Poll: *"Would you send production code to a hosted AI model?"* Yes, freely / Only with an enterprise contract / Only self-hosted / Never | Both stories are about trusting someone else's infrastructure. The split gives the admin a question to ask |
| 3 | **Show & Tell**: Spotlight + Demo | 15 | None | People are presenting. Don't pull eyes to phones |
| 4 | **Topic**: AI Bubble Bust (AI technology vs AI as a business) | 18 | Poll at the start: *"AI by 2028?"* 💥 Bursts / 📉 Slow deflate / 🚀 Still booming / 🤷 Tech stays, business crashes | Everyone commits to a side before the debate, so the debate has sides |
| 5 | **Problem clinic** | 8 | Word cloud: *"One word: your biggest blocker this month"* | The biggest words are the clinic's agenda. Quiet people name problems without having to explain them |
| 6 | **Kers' Boss Round** | 8 | Boss problem #1 | Ends on energy, not admin |
| 7 | **Wrap**: decisions, owners, next month | 4 | None | — |

Each activity opens when the admin reaches its segment (one button), and
closes when the admin moves on.

---

## Phase 1: Presenter mode

**Entry**
- From the day before (24 h, `MEET_REHEARSE_MS`), admins see a glowing
  meeting card at the top of the board, with Kers, and two actions:
  **Rehearse** and **Start meeting**.
- **Rehearse** opens `/meet/present?rehearse=1`: the full presenter screen on
  the real agenda, prep and seeded activities. Nothing goes live: no
  `started_at`, no presenter, no banner, no write to the API. Segments move
  locally; "Open" fills an activity with sample answers over ~25 s
  (`lib/meet/rehearse.ts`), so the poll reveal, the cloud and the Boss Round
  can be practised. `M` shows a phone preview beside it (the real `/meet`
  room, offline, as the presenter's own phone: cards and notes) whose
  answers land on the screen. The dev mock (`/meet/mock`) shows a phone as
  a member or as the presenter (`as=presenter`). Also linked from the Run
  tab (agenda builder and Meeting mode).
- **Start meeting** marks the meeting live (`meetings.started_at`). Members
  and guests then see the "Meeting is live, join the room" banner on the
  site. More than 3 h before the meeting (`MEET_LEAD_MS`) it asks first ("The
  meeting is tomorrow at 11:00. Start it now? Everyone will see the live
  banner."), on the board card, the presenter screen and the Run tab. Start
  stays admin-only on the server.

**Presenter screen** (`/meet/present`, full screen, admin only)
- No clock. The presenter finishes each item or skips it.
- Top: a small eyebrow (kind, "3 of 8"), the title, and one **cue** line:
  what the room does now ("Vote first, then we read them."). See "Cue and
  cards" below.
- The hero: the segment's **cards** in a grid (1-4 across, soft tint per
  kind, staggered in), with an activity waiting to open under them (the one
  saffron button). Open, the activity is the hero (its question and the
  live answers), and under a poll the cards step back to a strip. Closed,
  the cards come back and the result goes small under them (the final
  split, the top words, or the pass rate and Kers' verdict), with quiet
  **Show results big** and **Reopen** (`stageFor` in `lib/meet/activity.ts`).
- The presenter's notes (opener and talking points) are **never** on the
  shared screen: they go to the presenter's own phone (below). In Rehearse
  they show at the bottom (`P` hides them).
- Progress: one thin line with a dot per segment, evenly spaced, no labels.
  The current dot is larger; the presenter can click a dot to jump.
- ← / → (PageUp / PageDown for a clicker) move segments; subtle arrows sit at
  either end of the line. Esc leaves, F goes full screen. A refresh resumes in place.
- Kers, small, at the end of the line: a speech bubble now and then (a cheer
  when the presenter moves on, the Boss Round dare), never about time.
- Everything fits 1920 × 1080 with no scrolling. GuildBoard's own language,
  at a calm size: the wordmark and mono eyebrows, sans titles (~48–56 px),
  the cue with a small mint dot, poll options as the board's poll rows with a
  soft colour each, word-cloud words as pastel pills, the room as anonymous
  avatar seeds (never names).

**Cue and cards** (the agenda's shape: [07-agenda-and-script-guide.md](./07-agenda-and-script-guide.md), section 3)
- Each segment may carry `cue` (one line, ≤ 120, aim ≤ 90) and `cards` (≤ 6):
  `news` (title, source, link, why), `post` (a board post, drawn with the
  board's own card, `TopicCardHead`; ghost posts keep their ghost handle),
  `slot` (Show & Tell: label and invited / confirmed / open), `side` (the
  Topic's two sides), `note` (anything else, short). `lib/meeting.ts` `Card`.
- Instructions to the host are never cards and never the cue: they're notes.
- Old agendas without cards still render: their posts as post cards, else
  the detail as text.
- The posts are read server-side (`meetPosts` in `lib/guild/meetingPrep.ts`)
  for the presenter and for every phone.

**Kers' prep** (the standard and prompts: [07-agenda-and-script-guide.md](./07-agenda-and-script-guide.md))
- Drafted from each segment's topic (post, comments, votes) when the agenda is
  locked, or 3 h before at the latest.
- Admins edit it in the Run tab. If drafting fails, the segment shows only its
  title and detail.
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
- Joining only works while the meeting is live.
- The waiting area shows "Kers is setting up…" and how many people are in.
- The phone mirrors the screen. Between activities it shows the segment on
  screen now: title, cue and the same cards (news opens its source, a post
  its board page, both in a new tab), and "Up next". An activity opening
  swaps it in with a short transition; closed, the cards come back with a
  small results card on top. "Kers is setting up…" only shows with no agenda.
- **The presenter's own phone** (signed in as the one presenting) also
  shows **Your notes**: the opener and talking points for the segment.
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
- `meeting_activities`: meeting, segment id, kind (`poll` / `cloud` / `boss`),
  prompt, options, status (`ready` / `open` / `closed`), opened_at, closed_at.
- `meeting_responses`: activity, participant, value. Unique per participant for polls.
- The first run's activities are seeded into `meeting_activities` by a script, not through any UI.

**Stress test** (gates the first real meeting)
- A script opens 60 fake participants against a preview deploy. All 60 join,
  all vote within 5 s, then all send 3 words.
- Pass: the presenter screen catches up within 2 s, no lost or doubled
  answers, no API errors.

---

## Phase 3: Kers' Boss Round

**Flow**
1. The admin opens the Boss Round segment. Kers: *"You lot tell me what to
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

**Dev mock** (`/meet/mock`, dev only): November's real agenda
(`docs/agendas/2026-11.json`, read only; answers invented). `view=both`
puts the presenter beside a phone, synced over a `BroadcastChannel`: open
or close on the presenter and the phone follows; vote, add a word or run
the Boss Round tests on the phone and the presenter's counts move.
`rehearse=1` shows the rehearsal screen with its phone preview.

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
- **Seed:** `node --env-file=.env.local scripts/seed-meeting-activities.mjs`
  finds segments **by kind** (warm-up, radar, topic, clinic, boss), so it
  works on a drafted or hand-edited agenda. "Build from the board" now drafts
  the first-run format (warm-up and Boss Round included, 60 min).
- **Stress test:** `scripts/meet-stress.mjs --base <preview>` (needs the
  preview's service-role key; see the script's header). Not run yet.
- Activities a presenter opens close when they move on or end. A live
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
