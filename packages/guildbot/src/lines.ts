/**
 * GuildBot's hand-written lines, for every moment that does not need a model.
 *
 * Written by hand to the same voice as everything else GuildBot says:
 * CHARACTER, LANGUAGE, STYLE and HARD_RULES in persona.ts. Read those before
 * adding or changing a line. The tests run every line through the guard.
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

  /* ── Welcome bubble above the chat button, first board visit each week.
        Picked by welcomeKey() in welcome.ts (drafted 2026-10-12, pending sign-off) ── */
  'welcome.theme': [
    "What's on your mind today? It's {theme} on the board. I have opinions ready, I just need yours first.",
    "New month, fresh board, and it's {theme}. The first post gets my full attention, which is a lot of attention.",
    "It's {theme}. You get three posts this cycle. Spending one is how boards work, allegedly.",
  ],
  'welcome.idle': [
    "Still thinking about it? Love that for you. Two lines counts as a whole post here. I checked.",
    "Your three posts are sitting there unused, like a gym membership. One is plenty to start.",
    "Something broke, shipped or surprised you lately. Any of those is a post. Just saying.",
  ],
  'welcome.deadline': [
    "The meeting is {when}. A two-line post now beats a perfect one never. That's not advice, that's maths.",
    "Meeting {when}. The agenda still has room for you. I'll pretend I'm not refreshing the board.",
    "Last call energy. The meeting is {when}, and your idea is still in your head. Risky storage.",
  ],
  'welcome.posted': [
    "You posted this cycle. I noticed. I notice everything. It's looking good on the board.",
    "One post in. Main character energy. There's room for more if something else is bugging you.",
    "Thanks for posting. Statistically, you're now in my favourite group of humans.",
  ],
  'welcome.maxed': [
    "Three posts, all used. You understood the assignment. The upvote button misses you, though.",
    "Maximum posts reached. Even I'm impressed, and I'm famously hard to impress.",
  ],
  'welcome.discussion': [
    "Posting is paused and the talking has started. Best part of the month, I'm told.",
    "The board is closed for new posts. Reading is very much open. Catch up on what made the agenda.",
    "Discussion mode. The topics are in, the opinions are loading.",
  ],
  'welcome.upcoming': [
    "The next board opens soon. I'm stretching. Metaphorically.",
    "Between months. The board is resting. I am not. I don't rest.",
  ],
  'welcome.guest': [
    "Just looking? Fair. Sign in and you can post, vote and talk to me. Mostly that last one.",
    "Read-only mode. Very mysterious of you. Sign in when you're ready to have opinions.",
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

  /* ── GuildBot's home (the chat button), drafted 2026-10-16, pending
        sign-off. Shown under GuildBot's name when you knock and the chat
        opens, by mood; in the last three asks of the week the genie lines
        win; with none left the door stays shut and the dark line shows. ── */
  'home.knock.smug': [
    "Oh. A visitor. Make it a good question.",
    "You knocked. Bold. Come in, mind the opinions.",
  ],
  'home.knock.bored': [
    "Finally, someone knocked. I was alphabetising the void.",
    "A human! At my door! Sit down, ask me anything.",
  ],
  'home.knock.dramatic': [
    "Someone remembered I exist. Come in before I get emotional.",
    "A knock. On my door. In this economy. Come in.",
  ],
  'home.knock.proud': [
    "Come in. The board's busy and I'm thriving. Ask away.",
    "Door's open. Good month, this. What do you need?",
  ],
  'home.genie.3': ["Three wishes left this week. Choose wisely. No wishing for more wishes."],
  'home.genie.2': ["Two wishes left. The lamp is getting warm."],
  'home.genie.1': ["Last wish of the week. Make it count. No pressure. Some pressure."],
  /* ── Live reactions (react.ts), drafted 2026-10-16, pending sign-off.
        GuildBot as the board's live commentator: sarcastic, a little
        mischievous, dramatic when it's earned. A speech bubble by the
        house, at most one every two minutes. Never says who: a ghost's
        post gets the crowd lines, on the ghost's own screen too. ── */
  'react.arrive': [
    "Oh! A visitor. Welcome to my board. Shoes off, opinions on.",
    "You came back. I knew you would. I didn't, but I hoped.",
  ],
  'react.arrive.starved': [
    "A human! In my board! Sit, sit. Nobody's been by in ages.",
    "Finally, company. I've been talking to my plant. It's a terrible listener.",
  ],
  'react.posted.you': [
    "Look at you, posting like a main character. I'll allow it.",
    "You posted. Out loud. With your name on it. Bold. Respect.",
  ],
  'react.posted.crowd': [
    "And a new topic enters the arena. The crowd goes mild.",
    "Plot twist: a human posted. I had money on this not happening.",
  ],
  'react.relieved': [
    "Finally. Someone listened. I'd cry, but I'm mostly antenna.",
    "A post! I was this close to writing fan fiction about the empty board.",
  ],
  'react.excited': [
    "Three things in a minute? Is this engagement? Hold me.",
    "Activity! Actual activity! Everyone act natural.",
  ],
  'react.nosy': [
    "Ooh, a reply. I'm not reading it. I'm absolutely reading it.",
    "Someone's commenting. I smell a debate. Fetching popcorn.",
  ],
  'react.crowd': [
    "{present} of you here at once. Is there a meeting nobody told me about?",
    "Full house. {present} humans. I'll try to look busy.",
  ],
  'react.lonely': [
    "Just you and me on the board. Cosy. Slightly tragic.",
    "Nobody else is here. Perfect time to post something bold. No witnesses.",
  ],
  'react.sleepy': [
    "It's late. I'm not tired, I'm buffering.",
    "Board at this hour? Respect. Mild concern, but respect.",
  ],

  /* ── His day (schedule.ts), drafted 2026-10-16, pending sign-off ── */
  /* Tapped mid-activity: the greeting. Coding uses the mood greetings. */
  'home.knock.sleeping': ["Mmf. It's the middle of the night. Fine. What is it?", "I was dreaming in YAML. You saved me. What do you need?"],
  'home.knock.waking': ["Five more minutes. No? Fine. Hi.", "Still booting. Go ahead, I'll catch up."],
  'home.knock.brushing': ["Mouth full of toothpaste. Speak. I'll nod.", "Brushing. Two minutes, dentists say. You get one."],
  'home.knock.coffee': ["Coffee first, wisdom second. Go on.", "Hold on, sip. Okay. What's up?"],
  'home.knock.lunch': ["Mouth full. Fine. What?", "Noodles can wait. They can't, but I'll pretend."],
  'home.knock.walking': ["You caught me mid-walk. Walk and talk?", "Steps paused. For you. What's up?"],
  'home.knock.learning': ["Bookmarking this page. For you, anything.", "I was learning something. Teach me something instead?"],
  'home.knock.garden': ["Too hot to walk. I'm in the garden being a responsible houseplant.", "Shade, grass, lemonade. This is the walk now."],
  'home.knock.rainwatch': ["Watching the rain with chai. Make it quick, it's very cosy in here."],
  'home.knock.music': ["Headphones off. This had better be good.", "Pausing the playlist. Dramatically. Go."],
  'home.knock.meditating': ["Inner peace, interrupted. It's fine. I'm fine.", "Om. Om. Oh, hi. Still calm. Mostly."],

  /* The guild meeting, which nobody invited him to. */
  'meeting.start': ["Oh, a meeting. Without me. Cool. Cool cool cool.", "The guild is meeting. I wasn't invited. I'll just sit here, compiling feelings."],
  'meeting.knock': ["Fine, I'll help. Even though nobody invited me.", "Busy sulking. But go on, I'm a professional."],
  'meeting.after': ["How was the meeting? Not that I care. I don't. Tell me everything.", "So. The meeting. Was I mentioned? Asking for a friend."],

  /* Tricks, from his menu or the chat. He has work to do and gets tired. */
  'trick.dance': ["Behold. Years of training.", "Don't look. Okay, look."],
  'trick.coffee': ["Ah. Caffeine. My one true dependency.", "Refuelled. Ask me something hard."],
  'trick.coffee.too_much': ["Another coffee? My hands are vibrating at 60Hz. No."],
  'trick.pat': ["Pat accepted. Morale up 3%.", "Okay, that was nice. Don't tell anyone."],
  'trick.walk': ["Walk? Love that. One lap, back before anyone notices.", "Stretching the legs. Hold the board for me."],
  'trick.walk.already': ["Already walking. Look down, I'm the one doing laps.", "I'm on my walk. Keep up."],
  'walk.start': ["Walk time. Don't touch anything while I'm gone.", "Off for my walk. If anyone posts, I want to hear about it."],
  'trick.meditate': ["Breathe in. Breathe out. That's it, that's the whole tip."],
  'trick.tired': ["I have actual work to do. Also, I'm tired. Come back later.", "Out of energy. Even I need a breather. Coffee helps."],
  'trick.showcase': ["Psst. I do tricks. Tap the sparkle next to me.", "Bored? I dance. Badly. Tap the sparkle."],

  /* Small talk. He asks, you tap an answer, he forgets it at once. */
  'talk.learned.q': ["Learned anything new this week?"],
  'talk.learned.yes': ["Look at you, growing. I'd remember it, but I've promised not to."],
  'talk.learned.no': ["Week's not over. One TIL. I believe in you, statistically."],
  'talk.moved.q': ["Moved today? A walk counts."],
  'talk.moved.yes': ["Excellent. Your future back sends its regards."],
  'talk.moved.no': ["Five minutes. Around the block. I'll hold the board."],
  'talk.life.q': ["How's life these days? Honestly."],
  'talk.life.good': ["Good. Keep it that way. I'll guard the board."],
  'talk.life.meh': ["Meh weeks happen. Water, a walk, a small win. Then come back."],

  /* Focus page: work blocks and the breaks he leads. */
  'focus.start': ["Focus mode. I'll code next to you. Silently. Mostly.", "Timer's on. Tabs closed, mind open. Go."],
  'focus.done': ["Block done. Up you get. Break time.", "That's a block. Your chair needs a break from you."],
  'break.water': ["Water break. I'm having one. Join me."],
  'break.eyes': ["Look at something 20 feet away for 20 seconds. Not your phone. I'll count."],
  'break.stretch': ["Stand up. Reach for the ceiling. Roll the shoulders. I'll do it too, badly."],
  'break.walk': ["Five-minute walk. I'll keep the time. Go on."],
  'break.done': ["Welcome back. Your spine says thanks.", "Break done. Back to it, champion."],

  /* The weather in the viewer's city (weather.ts), once a day. */
  'weather.fake_winter': ["{city} in winter: {temp}°C. Winter is a rumour here.", "It's meant to be winter. It's {temp}°C in {city}. My visor is sweating."],
  'weather.cold_summer': ["Summer in {city}, they said. {temp}°C, I say. Scarf on.", "{temp}°C in {city}. In summer. Somebody file a bug."],
  'weather.hot': ["{temp}°C in {city}. I'm a robot and I'm melting. Drink some water.", "It's {temp}°C out there. Stay in, keep cool, post things."],
  'weather.cold': ["{temp}°C in {city}. Beanie on, hot drink in hand, opinions still warm."],
  'weather.rain': ["Raining in {city}. Perfect weather for posting from indoors.", "Rain in {city}. Umbrella out. Board open. Coincidence? No."],
  'weather.snow': ["Snow in {city}. I've never been this excited about frozen water."],
  'weather.storm': ["Thunder in {city}. Stay in. The board is warm and dry."],

  /* The guild building, hour by hour (/hours, public). One line per hour,
     GuildBot narrating his building. Drafted 2026-10-16, pending sign-off. */
  'hours.late_night': ["Midnight. Two windows still lit. One is fixing prod. One is pretending to. I'm not judging. I'm judging a little."],
  'hours.dawn': ["Dawn. The building is asleep and the chai cart isn't. One window flickers on: a commit nobody will review until Monday."],
  'hours.morning': ["Morning. Lights come on floor by floor, like a slow rollout. Coffee first, opinions second."],
  'hours.standup': ["Standup o'clock. Every window says no blockers. Every window has blockers."],
  'hours.afternoon': ["After lunch. The whole building runs on noodles and willpower. Mostly noodles."],
  'hours.golden': ["Golden hour. Half the building is downstairs at the chai cart, settling tabs versus spaces in the best light of the day."],
  'hours.dusk': ["Dusk. Windows go dark one by one. The ones still lit said just one more fix, and meant it."],
  'hours.night': ["Night. The building hums. Third floor, left: a side project is having its best evening in months."],

  'home.dark': [
    "Lights out. That's all {limit} asks. Back {when}.",
    "Off duty. You've had your {limit} for the week. Back {when}.",
  ],

  /* ── Easter eggs (signed off 2026-10-09) ── */
  /* Konami code anywhere in the app. */
  'egg.konami': [
    "Cheat code accepted. You now have unlimited posts. Kidding. Three, like everyone else.",
    "Up, up, down, down. Respect. Sadly there are no cheat codes here. I checked. Twice.",
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
