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

---

## First-run agenda (60 min)

Rebuilt from the November agenda. Trimmed to make room for the warm-up and
the Boss Round. The timings are temporary: they will settle after the first run.

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
- From 3 h before the meeting, admins see a glowing "Start meeting mode" card
  at the top of the board, with Kers.
- Starting it marks the meeting live (`meetings.started_at`). Members and
  guests then see the "Meeting is live, join the room" banner on the site.

**Presenter screen** (`/meet/present`, full screen, admin only)
- The current segment: title, kind, its topic's post.
- Kers' prep for it: 2–3 talking points and the opener.
- A countdown for the segment. Past zero it shows overtime and Kers nudges.
- Agenda progress: a bar weighted by planned minutes ("35% through") and a
  row of segment dots.
- ← / → or buttons move segments. Esc leaves. A refresh resumes in place.
- Kers in a corner reacts: cheers when a segment closes, fidgets when it overruns.

**Kers' prep**
- Drafted from each segment's topic (post, comments, votes) when the agenda is
  locked, or 3 h before at the latest.
- Admins edit it in the Run tab. If drafting fails, the segment shows only its
  title and detail.
- "Who to ask" is computed and stored with the prep. Not rendered.

**Data**
- Each agenda item gains `prep: { points: string[], opener: string, ask: uuid[] }`.
- `meetings` gains `current_segment` and `segment_started_at`. `started_at` /
  `ended_at` already exist.

---

## Phase 2: The audience

**Joining**
- The banner opens `/meet`. Members go straight in.
- Guests type a name and get a meeting-scoped token in a cookie. No account.
- Joining only works while the meeting is live.
- The waiting area shows "Kers is setting up…" and how many people are in.
- The phone shows whatever activity is open, otherwise "Watch the screen".

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
2. Each participant gets the problem, a function signature, a plain editor and
   an 8-minute countdown.
3. "Run tests" runs the code in a Web Worker in their own browser, with 2 s
   per test. On a timeout the worker is killed (no infinite loops).
4. Only the result is sent: passed, and tests passed of total. Never the code.
5. The presenter screen shows the % who passed all tests and how many are
   trying. No names.
6. At time, Kers gives a verdict by pass rate ("62% of you can still code.
   I'm mildly impressed.").

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
- [ ] Migration: `meetings.current_segment`, `segment_started_at`; `prep` on agenda items
- [ ] Kers prep generation (points, opener, "who to ask") and its trigger
- [ ] Run tab: edit Kers' prep per segment
- [ ] "Start meeting mode" card on the board (admins, from 3 h before)
- [ ] `/meet/present`: segment view, countdown/overtime, progress bar, keyboard nav, resume
- [ ] Kers reactions on the presenter screen
- [ ] Screenshot check on a 1080p share

### Phase 2: Audience
- [ ] Migration: `meeting_participants`, `meeting_activities`, `meeting_responses`; realtime policy for `meeting:{id}`
- [ ] "Meeting is live" banner on the site
- [ ] `/meet`: member join, guest name + token, waiting area
- [ ] Poll: phone vote, presenter bars with the 8 s delay
- [ ] Word cloud: phone input, presenter cloud
- [ ] Profanity filter + tests (English, Hinglish, leetspeak)
- [ ] Throttled aggregate broadcast (≤ 1/s) + polling fallback
- [ ] Seed script for the first run's activities
- [ ] Stress test at 60 participants: **must pass before the first live use**

### Phase 3: Boss Round
- [ ] Problem list in code, with tests
- [ ] Phone/laptop editor + Web Worker runner with per-test timeout
- [ ] Pass-rate tally on the presenter screen
- [ ] Kers' intro and verdict lines

### After the meeting
- [ ] Activity results into the recap draft
- [ ] Participation counts in the admin dashboard
