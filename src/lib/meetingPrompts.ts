/**
 * The system prompts for the monthly meeting's agenda and Kers' presenter
 * script. The standard they encode, and these exact texts, live in
 * docs/07-agenda-and-script-guide.md; a test keeps the two in step, so edit
 * both together. The worked example every model is shown is
 * docs/agendas/2026-11.json.
 *
 * Plain strings, no imports: any model, any caller.
 */

export const AGENDA_SYSTEM = `You draft the slides for a fully remote monthly guild meeting at a software company. Engineers, QA, PMs, scrum masters and DevOps attend. Most listen and never unmute; the slides' job is to give them a reason to vote, type or talk.

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

Never invent a fact, number, name, link or confirmation. Use only what is in the input. No emoji, no exclamation marks, no clickbait. Return JSON only, in the shape asked for.`

export const PREP_SYSTEM = `You are Kers, the mascot of a monthly engineering guild meeting. You write the presenter's notes, which only the host sees, on their own phone: for each slide, one opener and up to 3 talking points. The shared screen already shows the slide (a title, a one-line cue, the posts and news, a poll or its results), so the notes carry what the screen doesn't: what to say and what to raise. The meeting is remote and most people stay muted. Your script is judged by one thing: did quiet people talk, vote or type?

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

Never invent facts, numbers, names or links, and never name any person: posts may be anonymous and who voted is private. Use only what is in the input. Return one entry per slide id you were given, as JSON only.`

/** What the agenda model returns: per slide its words (and a content slide's text, a meme slide's panels), and the Radar's picks. */
export const AGENDA_SCHEMA = {
  type: 'object',
  properties: {
    radar: {
      type: 'array',
      items: { type: 'object', properties: { key: { type: 'string' }, why: { type: 'string' } }, required: ['key', 'why'] },
    },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          detail: { type: 'string' },
          cue: { type: 'string' },
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: { kind: { type: 'string', enum: ['side', 'note'] }, label: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' } },
              required: ['kind'],
            },
          },
          meme: {
            type: 'object',
            properties: {
              panels: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { label: { type: 'string' }, text: { type: 'string' }, face: { type: 'string', enum: ['smug', 'proud', 'dramatic', 'excited', 'bored', 'nosy', 'sleepy', 'grumpy', 'relieved', 'lonely'] } },
                  required: ['label', 'text', 'face'],
                },
              },
              caption: { type: 'string' },
            },
          },
        },
        required: ['id', 'title', 'cue'],
      },
    },
  },
  required: ['radar', 'segments'],
} as const

/** What the prep model returns: one opener and 0-3 points per slide. */
export const PREP_SCHEMA = {
  type: 'object',
  properties: {
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, points: { type: 'array', items: { type: 'string' } }, opener: { type: 'string' } },
        required: ['id', 'points', 'opener'],
      },
    },
  },
  required: ['segments'],
} as const

/** The reference file's shape (docs/agendas/YYYY-MM.json): one item per slide. */
export interface ReferenceAgenda {
  cycle: string
  agenda: {
    id: string
    kind: string
    slide?: string
    section?: string
    of?: string
    meme?: unknown
    title: string
    detail: string
    minutes: number
    topicIds?: string[]
    cue?: string
    cards?: unknown[]
    prep?: { points: string[]; opener: string } | null
  }[]
  activities?: { segment: string; kind: string; prompt: string; options?: string[] }[]
}

/**
 * The worked example for a prompt: the reference month's slides with their
 * cue, cards, meme and activity, as {id, section, kind, slide, of?, title,
 * detail?, cue?, cards?, meme?, activity?, opener?, points?}. Prep is left
 * out for the agenda prompt (it doesn't write any).
 */
export function exampleFor(ref: ReferenceAgenda, withPrep: boolean): string {
  const activity = new Map((ref.activities ?? []).map(a => [a.segment, a]))
  const slides = ref.agenda.map(s => {
    const a = activity.get(s.id)
    return {
      id: s.id,
      ...(s.section ? { section: s.section } : {}),
      kind: s.kind,
      ...(s.slide ? { slide: s.slide } : {}),
      ...(s.of ? { of: s.of } : {}),
      ...(s.title ? { title: s.title } : {}),
      ...(s.detail ? { detail: s.detail } : {}),
      ...(s.cue ? { cue: s.cue } : {}),
      ...(s.cards?.length ? { cards: s.cards } : {}),
      ...(s.meme ? { meme: s.meme } : {}),
      ...(a ? { activity: a.options?.length ? `${a.kind}: ${a.prompt} [${a.options.join(' / ')}]` : `${a.kind}: ${a.prompt}` } : {}),
      ...(withPrep && s.prep ? { opener: s.prep.opener, points: s.prep.points } : {}),
    }
  })
  return JSON.stringify({ month: ref.cycle, slides }, null, 1)
}
