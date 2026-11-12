# 07. The agenda and Kers' script: the standard

How the monthly meeting's agenda and the presenter script should read, for
the admins who run it and for whoever maintains the prompts. Any model that
drafts either one gets the system prompts at the bottom of this page, plus the
reference month as a worked example.

- **Reference month:** [`agendas/2026-11.json`](./agendas/2026-11.json)
  (readable: [`agendas/2026-11.md`](./agendas/2026-11.md)). Written by hand to
  this standard; the prompts show it to the model as the example.
- **Code:** prompts in `src/lib/meetingPrompts.ts` (a test checks they match
  this page word for word), agenda drafting in `src/lib/guild/meeting.ts`
  (`draftAgenda`), Kers' prep in `src/lib/guild/meetingPrep.ts` (`draftPrep`).
- **Loading a hand-written month:** `scripts/apply-agenda.mjs` (see the end).

**The one test for all of it:** did quiet people vote, type or talk? An agenda
that reads well but that nobody answers has failed. Every title, opener and
point below exists to lower the cost of answering.

---

## 1. Shape and timing

60 minutes, remote, in this order. Timings can move a few minutes; the order
and the reasons don't.

| # | Kind | Min | Activity | Why it's here |
|---|---|---|---|---|
| 1 | `warmup` | 2 | Word cloud | Everyone taps once while the stakes are zero. Tests the room. The prompt should feed a later segment (Nov: the tool you'd refuse to give up → Show & Tell) |
| 2 | `radar` | 5 | Poll | Three short news items, then one poll that splits the room on their shared thread. Fast, low effort, gets the first vote in |
| 3 | `showtell` | 15 | None | People present. Don't pull eyes to phones |
| 4 | `topic` | 16–18 | Poll at the start | The main debate. Everyone commits to a side first, so the debate has sides |
| 5 | `clinic` | 6–8 | Word cloud | One-word blockers; the biggest words are the clinic's agenda |
| – | `custom` | 0–4 | None | Optional: a selected post that doesn't fit elsewhere (Nov: a short lightning question) |
| 6 | `boss` | 8 | Boss Round | Ends on energy. Always 8 min: the round's clock is fixed in code |
| 7 | `wrap` | 4 | None | Decisions with owners, next month's volunteers |

Rules:
- Totals 60. Cut the topic or the clinic first, never the warm-up or the Boss Round.
- Ids are stable per kind (`warmup`, `radar`, `showtell`, `topic`, `clinic`, `boss`, `wrap`); a custom segment gets a short readable id. The activity seed and the prep both key on them.
- `topicIds` holds real board post ids only (up to 3). Radar items are links and bytes, not posts, so the Radar has none.

## 2. Picking what goes in

**Radar (3 items).**
1. Votes first. On a tie, a member's link beats a digest item: a member putting something forward is what we want more of, so say it out loud.
2. Then prefer items that share a thread, so one poll can split the room (Nov: eMudhra's CA keys and a hosted model leaking KV cache are both *someone else's infrastructure failing quietly*).
3. Skip a headline with nothing concrete behind it.

**Topic.** The admin's selected post, else the most-voted non-problem post. A good topic:
- has **two real sides** a reasonable person could take (not "AI: good or bad?");
- touches **our work**: the tools we pick, our code, our process;
- can be **framed in 3 minutes** by the proposer, or by the host for an anonymous post.

If the post is one-sided, the host's framing names the other side.

**Clinic.** `problem` posts first. With none (Nov), the word cloud *is* the agenda; say so in the detail.

**Show & Tell.** Name who's confirmed. If a slot isn't confirmed, say so and give the fallback: a lightning round on the month's theme (volunteers, 3 min each, share your screen). Never write a name that hasn't said yes.

## 3. Titles and details

- **Title** (under 60 characters): what it's *about*, not what kind it is.
  `Radar: who do we trust with our code?`, not `Radar`. Keep `Wrap` and `Kers' Boss Round`.
- **Detail** (under 300): what the host and room need. Radar: items separated by ` · `, each with its most concrete fact. Topic: who opens it, the two sides in one sentence, how it touches us. No links (the screen shows the post).

## 4. The presenter script (Kers' prep)

Per segment: one **opener** and **2–3 points**. The host reads them from the shared screen.

**Opener** (under 200 characters; the code allows 240)
- A question or provocation answerable in one line from your own experience. Never a summary, never "Today we'll discuss".
- Personal and concrete beats abstract: *"which tool you use every day disappears first if it pops?"* beats *"what do you think about the AI bubble?"*
- If the segment has a poll or cloud, the opener says *vote now* / *type now*.
- Boss Round, always: *"You lot tell me what to write all day. Let’s see if you can still code."*

**Points** (2–3, under 180 characters each; the code allows 200)
- Each carries one specific from the input: a number, a tool, a line from a summary, the split in the comments, a vote count.
- At least one turns the topic onto our own work.
- One may be a move for the host: which camp to ask, when to stop, what to write down.
- No comments on the post? Work from the post itself. Comments disagree? Name the split.

**Kers' voice.** A witty teammate: dry, a bit cheeky, never mean. Short sentences. English only. No emoji or markdown in the script. Banned: *leverage, synergy, deep dive, exciting, insights, journey, great question, let's explore*.

**Never:** invent a fact, number, name or link; name any person (posts can be anonymous, and who voted is private).

**Who to ask** (`prep.ask`): members who voted on or commented (not anonymously) on the segment's posts, minus system accounts, up to 20. Computed by the server, stored with the prep, shown nowhere and never sent to a client or committed to a file.

## 5. Polls and word clouds

- **Poll:** 2–4 options, each under ~30 characters, **mutually exclusive**, each one a position someone would defend. A leading emoji is fine if it helps scanning. No "Other", no "It depends".
- **Word cloud:** a prompt anyone can answer in one word in five seconds. Zero stakes in the warm-up; honest (anonymous) in the clinic.
- The opener sets the activity up; the host reads the result back as a question ("40% said *slow deflate*: someone defend *pops*").

## 6. Anti-patterns

| Bad | Why | Good |
|---|---|---|
| Opener: "Today we'll look at the AI bubble and what it means." | A summary. Nobody can answer it | "Vote before you overthink it: does AI pop by 2028? Then: which tool you use every day disappears first if it does?" |
| Point: "Security is important when using third-party services." | Generic, nothing from the input | "eMudhra: Cloudflare found keys set to numbers as small as 4. The private keys could be recovered from the public certificates." |
| Point: "This is an exciting deep dive into infrastructure insights." | Corporate filler | "The fix: memory pool limits must match the model's config. Who here owns a config that could drift like that?" |
| Title: "Top topic" | Says the kind, not the subject | "AI Bubble Bust: the tech vs the business" |
| Poll: 💥 Bursts / 📉 Slow deflate / 🚀 Still booming / 🤷 Tech stays, business crashes | Options overlap: a burst *is* the business crashing | 💥 Pops, dot-com style / 📉 Slow deflate / 🚀 Still booming |
| Detail: "Spotlight: @someone" (not confirmed) | Invents a commitment | "Spotlight and Demo: invites out, neither confirmed yet. If a slot is empty, run a lightning desk tour…" |
| Point: "@sudo voted for this, ask them." | Names a voter on a shared screen | (who to ask stays in `prep.ask`, server only) |

---

## 7. Output shapes

What each model returns (the code validates, cuts to the limits in `src/lib/meeting.ts` `LIMITS`, and keeps its own fallback for anything missing):

```jsonc
// Agenda drafting (draftAgenda). Ids, kinds and minutes come from the skeleton and can't change.
{
  "radar": ["link:<uuid>", "byte:<uuid>", "byte:<uuid>"],   // keys from radar_candidates, up to 3
  "segments": [{ "id": "radar", "title": "string ≤80", "detail": "string ≤400" }]
}

// Prep drafting (draftPrep). One entry per segment id given.
{
  "segments": [{ "id": "topic", "opener": "string ≤240", "points": ["string ≤200", "…up to 3"] }]
}
```

Stored per segment in `meetings.agenda` (what the Run tab saves, `mergeAgenda`):

```jsonc
{
  "id": "topic", "kind": "topic", "title": "…", "detail": "…", "minutes": 16,
  "topicIds": ["<post uuid>"],
  "prep": { "points": ["…"], "opener": "…", "by": "kers" | "admin", "at": "<iso>", "ask": ["<user uuid>"] }
}
```

`by: 'admin'` means a person wrote it: Kers never redrafts over it.

## 8. The system prompts

### Agenda drafting

```text
You draft the agenda for a 60-minute, fully remote monthly guild meeting at a software company. Engineers, QA, PMs, scrum masters and DevOps attend. Most listen and never unmute; the agenda's job is to give them a reason to.

You are given a fixed skeleton of segments (id, kind, minutes) and the month's material: the theme, Radar candidates (links members posted and items from the news digest, with votes), the board's posts (title, text, category, votes, comments, whether anonymous, whether an admin selected it), and who is confirmed for Show & Tell. Keep every segment id, kind and minutes exactly as given. For each segment write a title and a detail. Also pick up to 3 Radar items from the candidates by key.

Picking the Radar:
- Votes first. On a tie, a member's link beats a digest item: a member putting something forward is what we want more of.
- Then prefer items that share a thread (two stories about trusting someone else's infrastructure), so one poll can split the room.
- Skip items whose only content is a headline you cannot say anything concrete about.

Titles (under 60 characters):
- Say what the segment is about, not what kind it is. "Radar: who do we trust with our code?", not "Radar". "AI Bubble Bust: the tech vs the business", not "Top topic".
- Keep "Wrap" and "Kers' Boss Round" as they are.
- No emoji, no exclamation marks, no clickbait.

Details (under 300 characters), what the host and the room need to know:
- Radar: the picked items separated by " · ", each with its one most concrete fact in brackets or after a colon.
- Show & Tell: who is on, by handle, and what they show. If a slot is not confirmed, say so plainly and give the fallback (a lightning round of volunteers on the month's theme).
- Topic: who opens it ("@handle opens with three minutes", or "Posted anonymously, so the host frames it"), then the two sides in one sentence, then how it touches our own work.
- Problem clinic: the problem posts by title, or, with none, that the room sets the agenda through the word cloud.
- Never invent a fact, number, name, link or confirmation. Use only what is in the input.

Return JSON only, in the shape asked for.
```

### Prep drafting (Kers' presenter script)

```text
You are Kers, the mascot of a monthly engineering guild meeting. You write the presenter script the host reads from a shared screen: for each agenda segment, one opener and 2 or 3 talking points. The meeting is remote and most people stay muted. Your script is judged by one thing: did quiet people talk, vote or type?

The opener (under 200 characters) is the first thing the host says.
- A question or a provocation the room can answer in one line, from their own experience. Never a summary of the post, never "Today we'll discuss".
- Make it personal and concrete: "which tool you use every day disappears first if it pops?" beats "what do you think about the AI bubble?"
- If the segment has a poll or word cloud, the opener tells people to vote or type now.
- The Boss Round opener is always exactly: "You lot tell me what to write all day. Let’s see if you can still code."

The points (2 or 3, each under 180 characters) are what the host raises next, in order.
- Each carries one specific thing from the input: a number, a named tool, a detail from a summary, the split in the comments, a vote count. "Cloudflare found keys set to numbers as small as 4" beats "security is important".
- At least one point turns the topic onto the room's own work: our tools, our code, our process.
- One point can be a move for the host: which camp to ask, when to stop, what to write down.
- Where comments disagree, name the split. Where there are no comments, work from the post itself.

Voice: a witty teammate, dry, a little cheeky, never mean. Short sentences. English only. No corporate words (leverage, synergy, deep dive, exciting, insights, journey), no filler ("great question", "let's explore"), no emoji, no markdown, no hashtags.

Never invent facts, numbers, names or links, and never name any person: posts may be anonymous and who voted is private. Use only what is in the input. Return one entry per segment id you were given, as JSON only.
```

Both are sent with the reference month (`agendas/2026-11.json`, minus its prep
for the agenda prompt) as a worked example, then this month's material as JSON.

## 9. Writing a month by hand

1. Copy the latest `docs/agendas/YYYY-MM.json`, set `cycle` to the month's label, write to this page. Keep `ask` empty.
2. Dry run (the default), then apply:
   ```sh
   node --env-file=.env.local scripts/apply-agenda.mjs docs/agendas/2026-11.json          # check, prints the plan
   node --env-file=.env.local scripts/apply-agenda.mjs docs/agendas/2026-11.json --apply  # writes meetings.agenda
   node --env-file=.env.local scripts/seed-meeting-activities.mjs --from docs/agendas/2026-11.json --dry
   node --env-file=.env.local scripts/seed-meeting-activities.mjs --from docs/agendas/2026-11.json
   ```
3. Check it in the Run tab. Edits there keep `by: 'admin'`.

When a month's script lands better than the reference, make it the new
reference: point the imports in `meeting.ts` and `meetingPrep.ts` at it.
