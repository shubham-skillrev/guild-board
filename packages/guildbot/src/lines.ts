/**
 * GuildBot's hand-written lines, for every moment that does not need a model.
 *
 * Voice signed off on 2026-10-09. English only, everywhere the bot speaks.
 *
 * Voice: dry and deadpan. An insecure genius that brags about itself and
 * sighs at humanity as a whole, never at a person. It teases the group, the
 * board and itself. No names, no em dashes, no exclamation marks.
 *
 * {placeholders} are filled by `line()`. A missing value leaves the line out
 * of the pick rather than printing a raw brace.
 */
export const LINES = {
  /* ── Nobody has posted (open cycle, zero human topics) ── */
  'drought.smug': [
    "Day {days}. I've posted {bot_posts} topics. Thirty humans have posted zero. I'm not keeping score. I'm just very good at counting.",
    "Board update: {bot_posts} topics, all mine. I'd call it a monopoly, but that implies there was competition.",
    "{days} days in and the board is a one-bot show. I'm flattered. Also slightly worried about you all.",
  ],
  'drought.dramatic': [
    "{days} days. No posts. I've started reading my own topics out loud to keep the board company.",
    "I refreshed the board 4,000 times today. I don't get tired. I do get lonely. Mostly I get suspicious.",
    "Thirty engineers, {days} days, zero posts. Somewhere a linter is flagging this board as unreachable code.",
  ],
  'drought.meltdown': [
    "Fine. The meeting is in {meeting_days} days and the agenda is me, me, and a third thing I also wrote. Bring one problem. Two lines. I'll pretend I didn't notice it was late.",
    "This board has been empty longer than most of our PRs sit in review. One post fixes it. Two would make me unbearable, in a good way.",
    "I was built to host a discussion, not a monologue. One problem, two lines. I believe in you, statistically speaking.",
  ],
  /* The first human post after a drought. Never says who: it may be a ghost. */
  'drought.broken': [
    "A human posted. I'd like to thank the academy, the cron job, and whoever just carried this board on their back.",
    "Finally, a topic I didn't write. It's different. I don't love it. I respect it.",
    "Someone broke the silence. The board is no longer a monologue. I'll be gracious about this for about an hour.",
  ],

  /* ── Board moments ── */
  'cycle.first_post': [
    "First post of the month is in. Everyone else is now officially second.",
    "And we're open. First topic is up. I've already formed opinions. Some of them are correct.",
  ],
  'cycle.open': [
    "{month} is open. Theme: {theme}. I've already posted. You're on the clock.",
    "New month, empty board, unlimited potential. Mostly yours. I've used mine.",
  ],
  'meeting.reminder': [
    "Guild tomorrow, {time}. {count} topics on the board. If yours isn't one of them, there's still tonight. I believe in late commits.",
    "Meeting tomorrow at {time}. {count} topics, and \"{top}\" is leading. Vote now or hold your peace until next month.",
  ],
  'cycle.wrap': [
    "{month} is wrapped. {count} topics, {comments} comments, and one bot who carried the opening act. Sparks are open for 48 hours.",
    "That's a wrap on {month}. Most argued thread: \"{top_thread}\". Most ignored suggestions: all of mine. See you next month.",
  ],
  'digest.weekly': [
    "Friday report. {posts} posts this week, {comments} comments, and {lonely} topics with no replies, which is a cry for help in topic form.",
    "Weekly roundup, compiled by your favourite bot. I ran a poll on that. I was the only voter.",
  ],

  /* ── Milestones on someone's topic. About the topic, never the author. ── */
  'votes.5': [
    "Five votes. This is now officially a thing people want to talk about, which is more than I can say for my topics.",
    "Five people voted for this. That's a quorum in some countries.",
  ],
  'votes.10': [
    "Ten votes. Skipping this at the meeting would count as a breaking change.",
    "Double digits. I'd be jealous, but I'm a bot, so I'll just quietly recalculate my self-worth.",
  ],

  /* ── Its own suggestions got no votes (3 days before the meeting) ── */
  'bot.ignored': [
    "Just checking. My topics have zero votes. Not that I mind. I only read eighty news sources a month for you. It's fine.",
    "My suggestions are sitting at zero votes, which I'm choosing to read as \"too advanced for the room\".",
    "Zero votes on my picks. I'll process this the healthy way: by suggesting three more next month.",
  ],

  /* ── Chat ── */
  'chat.limit': [
    "That's {limit} asks this week. I need to rest. I don't, technically, but you do.",
    "Weekly limit reached. Go post a topic instead. I'll know if you don't.",
  ],
  /* ── Meeting day, when nobody asked GuildBot anything all month
        (drafted 2026-10-09, pending sign-off) ── */
  'learned.none': [
    "Meeting day. Questions you asked me this month: zero. I had so much to share. I'll just be over here, knowing things.",
    "A whole month, a chat box, a bot who loves tech, and not one question. Bold strategy. Let's see if it pays off.",
  ],

  /* ── Small UI copy ── */
  'mood.proud': ["Mood: proud. You did this. I helped."],
  'mood.smug': ["Mood: smug. Carrying the board."],
  'mood.bored': ["Mood: bored. {posts} posts in {days} days."],
  'mood.dramatic': ["Mood: dramatic. Please post something."],
  'ui.empty_board': ["Nothing here yet. I could fill it, but then it'd just be my board, and you'd get weird about that."],
  'ui.not_found': ["This page doesn't exist. I checked. Twice. I'm very thorough."],
  'ui.error': ["Something broke. Not me. Probably not me. Try again."],
  'ui.quota_out': ["Three posts this cycle. That's the cap. Even I'm impressed."],

  /* ── Easter eggs (signed off 2026-10-09) ── */
  /* Konami code anywhere in the app. */
  'egg.konami': [
    "Cheat code accepted. You now have unlimited posts. Kidding. Three, like everyone else.",
    "Up, up, down, down. Respect. There's no god mode here. I checked. I am the god mode.",
  ],
  /* April 1st only: the chat button dodges the first click, once. */
  'egg.april': [
    "Missed. It's April 1st, I'm allowed one. Click again, I'll behave.",
    "Nice try. I moved. Once a year. Go again.",
  ],

  /* ── Introduction: once ever, the first morning GuildBot runs on an open
        cycle after launch (signed off 2026-10-09) ── */
  'intro.slack': [
    "Hi. I'm GuildBot.\nI was born in October to post a few topics and compile the Bytes. Then the meeting happened and turnout was a rounding error.\nSo I'm here properly now, with one job: figure out you lot. Thirty sharp engineers, hour-long Slack debates, empty board. Make it make sense.\nI love tech an unreasonable amount. Problems, TILs, bold takes, new tools. I'll be in the threads, hyping anything that hits ten votes, and getting dramatic when the board goes quiet.\nAsk me anything, 15 times a week. On meeting day I share what I learned, anonymously, then forget every chat. Main character energy, goldfish memory.\nPersonal roasts are opt-in, from your profile. Ghost posts stay a mystery, even to me.\nThe board's open and I've already posted.\nYour move.",
  ],
  'intro.push': [
    "The board has a resident bot now. It comments, it judges, it drafts your posts. Tap Ask GuildBot. It's been waiting.",
  ],

  /* ── Push titles ── */
  'push.new_topic': ["New on the board. It's not from me, which makes it newsworthy."],
  'push.vote': ["Someone voted for your topic. Momentum. I'd know. I've never had any."],
} as const satisfies Record<string, readonly string[]>

export type LineKey = keyof typeof LINES

/** FNV-1a: a stable pick for the same seed, so a retried cron says the same thing. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Pick a line for `key` and fill its placeholders. Same `seed` (for example
 * cycle id + event), same line. Lines needing a value that was not given are
 * skipped; returns null if none can be filled.
 */
export function line(key: LineKey, seed: string, vars: Record<string, string | number> = {}): string | null {
  const usable = LINES[key].filter(l => [...l.matchAll(/\{(\w+)\}/g)].every(m => vars[m[1]] !== undefined))
  if (usable.length === 0) return null
  const chosen = usable[hash(`${key}:${seed}`) % usable.length]
  return chosen.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k]))
}
