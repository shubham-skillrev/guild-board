# 07. The agenda and Kers' script: the standard

How the monthly meeting's slides and the presenter script should read, for
the admins who run it and for whoever maintains the prompts. Any model that
drafts either one gets the system prompts at the bottom of this page, plus the
reference month as a worked example.

- **Reference month:** [`agendas/2026-11.json`](./agendas/2026-11.json)
  (readable: [`agendas/2026-11.md`](./agendas/2026-11.md)). Written by hand to
  this standard; the prompts show it to the model as the example.
- **Code:** prompts in `src/lib/meetingPrompts.ts` (a test checks they match
  this page word for word), agenda drafting in `src/lib/guild/meeting.ts`
  (`draftAgenda`), Kers' prep in `src/lib/guild/meetingPrep.ts` (`draftPrep`),
  the shape in `src/lib/meeting.ts` (`Segment`, `cleanAgenda`).
- **Loading a hand-written month:** `scripts/apply-agenda.mjs` (see the end).

**The one test for all of it:** did quiet people vote, type or talk? Slides
that read well but that nobody answers have failed. Every word below exists
to lower the cost of answering.

---

## 1. Slides, not segments

The agenda is a flat list of **slides**, as many as the flow needs, grouped
into **sections** by `section` (consecutive slides with the same value). Not
timed: every slide has `minutes: 0`, and the presenter moves on when it's
done. How the screen and phones draw each kind: docs/06, "Slides".

| `slide` | What it is | Words |
|---|---|---|
| `title` | A section's "next up": title and cue | title ≤ 40, cue ≤ 90, `detail` for Slack |
| `content` | Real cards (posts, news) and/or plain text (sides, notes) | title ≤ 40, cue ≤ 90 |
| `activity` | A poll, word cloud or Boss Round. Opens on arrival, closes on leaving | short title, cue "vote now" |
| `results` | The activity's results, big; `of` names the activity slide | short title, cue that starts the talk |
| `text` | One big statement or question | title ≤ 60, cue ≤ 90 |
| `meme` | A joke between sections: Kers panels or an image | panel lines ≤ 50 |

`kind` is the section's kind (`warmup`, `radar`, `topic`, `clinic`, `boss`,
`wrap`, `custom`); `showtell` is still accepted but not used while the guild
has no Spotlight or Demo.

## 2. Designing the flow

- **Open on a tap.** A title slide that gets phones out, then a word cloud
  anyone can answer in five seconds.
- **Every activity is two slides:** the `activity` slide (the room answers)
  and right after it its `results` slide (the room talks). The flow is in the
  agenda, so the presenter never has to remember to open or close anything.
- **Content before the vote.** Show what the vote is about (the news, the
  post and its two sides), then vote, then results, then the debate prompt
  as a `text` slide.
- **Title slides are "next up" moments** between sections. Use them where a
  section changes gear, not before every slide.
- **Memes between sections**, 2–4 a month, each tied to the section it opens.
- **End on energy:** the Boss Round, then a short Wrap.
- Ids are short and readable (`radar-poll`, `radar-results`); activities key
  on them. `topicIds` holds real board post ids only (up to 3).

**Picking what goes in**
- **Radar (3 items).** Votes first; on a tie, a member's link beats a digest
  item (say it out loud). Then prefer items that share a thread, so one poll
  can split the room (Nov: eMudhra's CA keys and a hosted model leaking KV
  cache are both *someone else's infrastructure failing quietly*). Skip a
  headline with nothing concrete behind it.
- **Topic.** The admin's selected post, else the most-voted non-problem post:
  two real sides, touches our work, framed in 3 minutes (by the host for an
  anonymous post).
- **Clinic.** `problem` posts first. With none (Nov), the word cloud *is* the
  agenda.
- **Show & Tell.** Not a section while nobody is confirmed. Never write a
  name that hasn't said yes.

## 3. What the room sees

- **Cue** (≤ 90 characters; the code allows 120): what the room does now.
  `Vote on your phone.` · `Smallest camp: defend it.` Never a summary, never a
  note to the host.
- **Fewer words.** A slide is read from across a room in two seconds. If a
  line repeats the title, cut it.
- **Cards are only real content:**

| Kind | Shape | Drawn as |
|---|---|---|
| `news` | `{ title, source, url, why, from? }` | A card: the item's real link, one concrete line. `from: "member"` shows "A member's pick" |
| `post` | `{ postId }` | The board's own card (ghost posts keep their ghost handle) |
| `side` | `{ label, text }` | Plain text, two columns: a debate's two sides, fair to both |
| `note` | `{ title, text? }` | Plain text, a compact list: "Git history" / "a linked list" |

There is no `slot` kind any more. Instructions to the host are never on a
slide: they're the notes (section 4).

### Memes

Workplace-safe developer humour tied to the section, original. No real
people, no known meme formats by name, nobody in the room as the joke.

- **Kers memes** (the default; November uses only these):
  `"meme": { "panels": [{ "label": "The pitch deck", "text": "AI-powered everything", "face": "excited" }, { "label": "The invoice", "text": "AI-priced everything", "face": "dramatic" }], "caption": "optional punchline" }`.
  One or two panels; `face` is one of `smug proud dramatic excited bored nosy sleepy grumpy relieved lonely`.
- **Image memes:** put the file in `public/meet/memes/` and set
  `"meme": { "src": "/meet/memes/name.png", "alt": "what it shows", "caption": "optional" }`
  (png, jpg, gif, webp or svg; `alt` is required). Only images you made or
  have the rights to; never hotlink.

## 4. The presenter script (Kers' prep)

Per slide: one **opener** and **0–3 points** (memes have none). Only the
presenter sees them: on their own phone in the room (`/meet`, signed in as
the one presenting) and in Rehearse. Never on the shared screen, never sent
to anyone else.

**Opener** (under 200 characters; the code allows 240)
- A question or provocation answerable in one line from your own experience. Never a summary, never "Today we'll discuss".
- Personal and concrete beats abstract: *"which tool you use every day disappears first if it pops?"* beats *"what do you think about the AI bubble?"*
- On an activity slide, *vote now* / *type now*. On a results slide, the result read back as a question.
- The Boss Round's title slide, always: *"You lot tell me what to write all day. Let’s see if you can still code."*

**Points** (up to 3, under 180 characters each; the code allows 200)
- Each carries one specific from the input: a number, a tool, a line from a summary, the split in the comments, a vote count.
- Across a section, at least one turns the topic onto our own work.
- One may be a move for the host: which camp to ask, when to close the vote, what to write down.

**Kers' voice.** A witty teammate: dry, a bit cheeky, never mean. Short sentences. English only. No emoji or markdown in the script. Banned: *leverage, synergy, deep dive, exciting, insights, journey, great question, let's explore*.

**Never:** invent a fact, number, name or link; name any person (posts can be anonymous, and who voted is private).

**Who to ask** (`prep.ask`): members who voted on or commented (not anonymously) on the slide's posts, minus system accounts, up to 20. Computed by the server, stored with the prep, shown nowhere and never sent to a client or committed to a file.

## 5. Polls and word clouds

- **Poll:** 2–4 options, each under ~30 characters, **mutually exclusive**, each one a position someone would defend. No emoji: each option gets its own shape and colour on screen and phone. No "Other", no "It depends".
- **Word cloud:** a prompt anyone can answer in one word in five seconds. Zero stakes in the warm-up; honest (anonymous) in the clinic.
- The results slide's cue turns the result into talk ("Smallest camp: defend it.").

## 6. Anti-patterns

| Bad | Why | Good |
|---|---|---|
| Opener: "Today we'll look at the AI bubble and what it means." | A summary. Nobody can answer it | "Vote before you overthink it: does AI pop by 2028?" |
| Point: "Security is important when using third-party services." | Generic, nothing from the input | "eMudhra: Cloudflare found keys as small as 4." |
| Title: "Top topic" | Says the kind, not the subject | "The tech vs the business" |
| One slide with the news, the poll and the debate | The presenter has to remember to open and close; the screen is crowded | News (content) → poll (activity) → results → debate (text) |
| Poll: Bursts / Slow deflate / Still booming / Tech stays, business crashes | Options overlap: a burst *is* the business crashing | Pops, dot-com style / Slow deflate / Still booming |
| A `note` card for "Side A", "Your code stays on your device" | Summary dressed as content | `side` entries (plain text), or cut it |
| Cue: "Read the three examples aloud" | A host instruction on the shared screen | The instruction goes in the notes |
| Point: "@sudo voted for this, ask them." | Names a voter | (who to ask stays in `prep.ask`, server only) |
| A meme about a colleague, or a famous meme image from the web | Not ours, not kind | A Kers meme about the section's subject |

---

## 7. Shapes

What each model returns (the code validates, cuts to the limits in `src/lib/meeting.ts` `LIMITS`, and keeps its own fallback for anything missing):

```jsonc
// Agenda drafting (draftAgenda). Ids, sections, kinds and slide types come from the skeleton.
{
  "radar": [{ "key": "link:<uuid>", "why": "string ≤180" }],   // keys from radar_candidates, up to 3
  "segments": [{
    "id": "topic-post", "title": "string ≤80", "cue": "string ≤120", "detail": "title slides only",
    "cards": [{ "kind": "side", "label": "≤40", "text": "≤180" }, { "kind": "note", "title": "≤120", "text": "≤180" }],  // content slides only
    "meme": { "panels": [{ "label": "≤40", "text": "≤90", "face": "smug" }], "caption": "≤90" }                     // meme slides only
  }]
}
// The server builds the news cards (from the picks: real titles and links)
// and the post cards itself; the model's text is only sides and notes.

// Prep drafting (draftPrep). One entry per slide id given (memes are never sent).
{
  "segments": [{ "id": "topic-post", "opener": "string ≤240", "points": ["string ≤200", "…up to 3"] }]
}
```

Stored per slide in `meetings.agenda` (what the Run tab saves, `mergeAgenda`):

```jsonc
{
  "id": "topic-results", "kind": "topic", "slide": "results", "section": "AI Bubble Bust",
  "of": "topic-poll",                       // results only
  "meme": { … },                            // meme only
  "title": "AI by 2028", "detail": "", "minutes": 0,
  "topicIds": [],
  "cue": "Which tool you use every day disappears first if it pops?",
  "cards": [{ "kind": "post", "postId": "<post uuid>" }, { "kind": "side", "label": "The tech stays", "text": "…" }],
  "prep": { "points": ["…"], "opener": "…", "by": "kers" | "admin", "at": "<iso>", "ask": ["<user uuid>"] } | null
}
```

`by: 'admin'` means a person wrote it: Kers never redrafts over it.

Activities live beside the agenda in the file, one per `activity` slide,
named by the slide's id:

```jsonc
"activities": [
  { "segment": "topic-poll", "kind": "poll", "prompt": "AI by 2028?", "options": ["Pops, dot-com style", "Slow deflate", "Still booming"] },
  { "segment": "boss-round", "kind": "boss", "prompt": "Sum of the even numbers", "options": [], "config": { "problem": 1 } }
]
```

## 8. The system prompts

### Agenda drafting

```text
You draft the slides for a fully remote monthly guild meeting at a software company. Engineers, QA, PMs, scrum masters and DevOps attend. Most listen and never unmute; the slides' job is to give them a reason to vote, type or talk.

You are given a fixed skeleton of slides (id, section, kind, slide) and the month's material: the theme, Radar candidates (links members posted and items from the news digest, with votes) and the board's posts (title, text, category, votes, comments, whether anonymous, whether an admin selected it). Keep every slide id, section, kind and slide exactly as given, in order. For each slide write what its slide type needs. Also pick up to 3 Radar items from the candidates by key, each with one line on why it matters.

What the room sees: the shared screen and every phone show the current slide. The host's notes are written separately and never shown. Fewer words always win: a slide is read from across a room in two seconds.

Slide types:
- title: a section's "next up". A title under 40 characters on what the section is about ("Who do we trust with our code?", not "Radar"), a cue, and a detail under 200 characters for the Slack agenda.
- content: a title under 40 characters and a cue. The server adds the board's posts and the Radar's news as cards. You may add plain text: for a debate, two side entries (a label under 30 characters, one line under 90 in its defence, fair to both); otherwise up to 3 note entries (a title under 40 characters and an optional few words: "Git history" / "a linked list").
- activity: a short title and a cue telling the room to vote or type. The poll or word cloud itself is set up separately.
- results: a short title and a cue that turns the result into talk: "Smallest camp: defend it."
- text: one big statement or question as the title, under 60 characters, and a cue under it.
- meme: one or two panels, each Kers (a mint blob mascot) with a face (smug, proud, dramatic, excited, bored, nosy, sleepy, grumpy, relieved, lonely), a label under 20 characters and a line under 50 ("The pitch deck" / "AI-powered everything", then "The invoice" / "AI-priced everything"), and an optional caption. Original, workplace-safe developer humour about the next section's subject. Never a known meme format by name, never a real person, never mocking anyone in the room.

The cue (under 90 characters): one line telling the room what to do now. "Vote on your phone." "One word. Nobody sees who typed what." An instruction to the room, never a note to the host and never a summary.

Picking the Radar:
- Votes first. On a tie, a member's link beats a digest item: a member putting something forward is what we want more of.
- Then prefer items that share a thread (two stories about trusting someone else's infrastructure), so one poll can split the room.
- Skip items whose only content is a headline you cannot say anything concrete about.
- Each pick's why (under 90 characters): its most concrete fact, from its summary.

Never invent a fact, number, name, link or confirmation. Use only what is in the input. No emoji, no exclamation marks, no clickbait. Return JSON only, in the shape asked for.
```

### Prep drafting (Kers' presenter script)

```text
You are Kers, the mascot of a monthly engineering guild meeting. You write the presenter's notes, which only the host sees, on their own phone: for each slide, one opener and up to 3 talking points. The shared screen already shows the slide (a title, a one-line cue, the posts and news, a poll or its results), so the notes carry what the screen doesn't: what to say and what to raise. The meeting is remote and most people stay muted. Your script is judged by one thing: did quiet people talk, vote or type?

The opener (under 200 characters) is the first thing the host says on that slide.
- A question or a provocation the room can answer in one line, from their own experience. Never a summary of the post, never "Today we'll discuss".
- Make it personal and concrete: "which tool you use every day disappears first if it pops?" beats "what do you think about the AI bubble?"
- On an activity slide (a poll or word cloud), the opener tells people to vote or type now. On a results slide, it reads the result back as a question.
- The Boss Round's title slide opener is always exactly: "You lot tell me what to write all day. Let’s see if you can still code."

The points (0 to 3, each under 180 characters) are what the host raises next, in order. A title or activity slide needs one or none; a content or results slide two or three.
- Each carries one specific thing from the input: a number, a named tool, a detail from a summary, the split in the comments, a vote count. "Cloudflare found keys set to numbers as small as 4" beats "security is important".
- Across a section, at least one point turns the topic onto the room's own work: our tools, our code, our process.
- One point can be a move for the host: which camp to ask, when to close the vote, what to write down.
- Where comments disagree, name the split. Where there are no comments, work from the post itself.

Voice: a witty teammate, dry, a little cheeky, never mean. Short sentences. English only. No corporate words (leverage, synergy, deep dive, exciting, insights, journey), no filler ("great question", "let's explore"), no emoji, no markdown, no hashtags.

Never invent facts, numbers, names or links, and never name any person: posts may be anonymous and who voted is private. Use only what is in the input. Return one entry per slide id you were given, as JSON only.
```

Both are sent with the reference month (`agendas/2026-11.json`, minus its prep
for the agenda prompt) as a worked example, then this month's material as JSON.

## 9. Writing a month by hand

1. Copy the latest `docs/agendas/YYYY-MM.json`, set `cycle` to the month's label, write to this page. Keep `ask` empty.
2. Dry run (the default), then apply. The script checks the shape: every activity slide has exactly one activity, every results slide's `of` is an activity slide, memes are valid.
   ```sh
   node --env-file=.env.local scripts/apply-agenda.mjs docs/agendas/2026-11.json          # check, prints the plan
   node --env-file=.env.local scripts/apply-agenda.mjs docs/agendas/2026-11.json --apply  # writes meetings.agenda
   node --env-file=.env.local scripts/seed-meeting-activities.mjs --from docs/agendas/2026-11.json --dry
   node --env-file=.env.local scripts/seed-meeting-activities.mjs --from docs/agendas/2026-11.json
   ```
3. Check it in the Run tab and in Rehearse. Edits there keep `by: 'admin'`.

When a month's script lands better than the reference, make it the new
reference: point the imports in `meeting.ts` and `meetingPrep.ts` at it.
