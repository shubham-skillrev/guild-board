'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { daySeed, isoWeek, meetingJustEnded, meetingOn, moodFor, moodOfDay, reactTo, type BoardEvent, type Expression, type LineKey, type Mood } from '@guildboard/guildbot'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { botSays, SASS } from '@/lib/guildbot-host/voice'
import { listen } from '@/lib/guildbot-host/live-bus'

const DAY = 86_400_000
/** How long a reaction's face holds before GuildBot settles back into his mood. */
const REACTION_MS = 8000
/** At most one unprompted speech bubble this often, across pages (sessionStorage). */
const BUBBLE_GAP_MS = 2 * 60_000
const BUBBLE_MS = 6500
const LAST_BUBBLE = 'guildbot:last-bubble'
const QUIET = 'guildbot:quiet'
const HIDDEN = 'guildbot:hidden'
const ARRIVED = 'guildbot:arrived'
const ENERGY = 'guildbot:energy'
/** Tricks before he's tired; one comes back every ENERGY_REGEN_MS. */
const ENERGY_MAX = 5
const ENERGY_REGEN_MS = 15 * 60_000
const COFFEES_PER_DAY = 2

export type Trick = 'dance' | 'pat' | 'coffee' | 'meditate' | 'walk'
export interface Chip { label: string; reply: LineKey }
/** `stay`: he says it where he is (no stroll out for it). */
export interface Bubble { id: number; text: string; chips?: Chip[]; stay?: boolean }

/* Small talk, one question a day. He asks, you tap, he forgets at once. */
const TALK: { q: LineKey; chips: Chip[] }[] = [
  { q: 'talk.learned.q', chips: [{ label: 'Yes!', reply: 'talk.learned.yes' }, { label: 'Not yet', reply: 'talk.learned.no' }] },
  { q: 'talk.moved.q', chips: [{ label: 'Yes', reply: 'talk.moved.yes' }, { label: 'Not yet', reply: 'talk.moved.no' }] },
  { q: 'talk.life.q', chips: [{ label: 'Good', reply: 'talk.life.good' }, { label: 'Meh', reply: 'talk.life.meh' }] },
]

/**
 * GuildBot being alive on the page.
 *
 *  - His mood from this month's counts, kept current as the board changes,
 *    and his live reactions to it (react.ts in the package: the rules,
 *    tested). Hears the board through the page's own live channel
 *    (live-bus.ts) and the viewer's own posts; counts only, so it names
 *    nobody, and a ghost's post looks like a stranger's.
 *  - A visitor is an event: he perks up when you arrive. The day after a
 *    guild meeting, he wants to hear how it went (not that he cares). While
 *    it's on, he sulks: nobody invited him.
 *  - Tricks on request (dance, pat, coffee, meditate). He has work to do:
 *    five tricks and he's tired, one back every fifteen minutes; coffee
 *    perks him up, twice a day at most.
 *  - Now and then, unprompted: a weekly "I do tricks" and a daily bit of
 *    small talk with tap-to-answer chips, forgotten as soon as answered.
 *
 * Everything here is per device (localStorage, sessionStorage). Two
 * switches: quiet for today (faces, no bubbles) and hidden (no antics).
 */
export function useGuildBotLife() {
  const { cycle } = useCurrentCycle()
  const [mood, setMood] = useState<Mood>('smug')
  const [moodLine, setMoodLine] = useState<string | null>(null)
  const [reaction, setReaction] = useState<Expression | null>(null)
  /** His cursor state for a moment: a click ripple when he's pleased, ⊘ when he won't. */
  const [cursor, setCursor] = useState<'pleased' | 'refusing' | null>(null)
  const [bubble, setBubble] = useState<Bubble | null>(null)
  const [hop, setHop] = useState(0)
  const [trick, setTrick] = useState<'dance' | 'pat' | null>(null)
  /** A walk across the bottom of the screen and back; the id restarts it. */
  const [patrol, setPatrol] = useState<number | null>(null)
  const [meeting, setMeeting] = useState(false)
  const [prefs, setPrefs] = useState({ quiet: false, hidden: false })

  const humanPosts = useRef<number | null>(null)
  const moodRef = useRef<Mood>('smug')
  const recent = useRef<number[]>([])
  const votes = useRef(new Map<string, number>())
  const present = useRef(0)
  const selfPost = useRef<{ anonymous: boolean; at: number } | null>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({})
  const prefsRef = useRef(prefs)
  useEffect(() => { prefsRef.current = prefs }, [prefs])

  useEffect(() => {
    const today = new Date().toDateString()
    const id = setTimeout(() => setPrefs({ quiet: localStorage.getItem(QUIET) === today, hidden: localStorage.getItem(HIDDEN) === '1' }), 0)
    return () => clearTimeout(id)
  }, [])

  const later = (name: string, ms: number, fn: () => void) => {
    clearTimeout(timers.current[name])
    timers.current[name] = setTimeout(fn, ms)
  }

  /** A cursor state for a moment. */
  const flash = useCallback((kind: 'pleased' | 'refusing', ms = 1400) => {
    setCursor(kind)
    later('cursor', ms, () => setCursor(null))
  }, [])

  /** A face for a few seconds, and a hop. */
  const pullFace = useCallback((e: Expression) => {
    setReaction(e)
    setHop(h => h + 1)
    later('reaction', REACTION_MS, () => setReaction(null))
  }, [])

  /**
   * Say a line in a bubble. Unprompted lines wait out the two-minute gap;
   * answers to something you did (`asked`) never wait.
   */
  const speak = useCallback((key: LineKey, opts: { asked?: boolean; chips?: Chip[]; vars?: Record<string, string | number>; ms?: number; stay?: boolean } = {}) => {
    if (!SASS || prefsRef.current.hidden) return false
    if (!opts.asked && prefsRef.current.quiet) return false
    const now = Date.now()
    if (!opts.asked && now - Number(sessionStorage.getItem(LAST_BUBBLE) ?? 0) < BUBBLE_GAP_MS) return false
    const text = botSays(key, `${key}:${Math.floor(now / 60_000)}`, 'ui', { present: present.current, ...opts.vars })
    if (!text) return false
    sessionStorage.setItem(LAST_BUBBLE, String(now))
    setBubble({ id: now, text, chips: opts.chips, stay: opts.stay || !!opts.chips })
    later('bubble', opts.ms ?? (opts.chips ? 20_000 : BUBBLE_MS), () => setBubble(null))
    return true
  }, [])

  const react = useCallback((event: BoardEvent) => {
    if (!SASS || prefsRef.current.hidden) return
    const now = Date.now()
    recent.current = recent.current.filter(t => now - t < 60_000)
    const r = reactTo(event, { mood: moodRef.current, recent: recent.current.length, hour: new Date().getHours() })
    recent.current.push(now)
    // A new post or a vote: he clicks along.
    if (event.kind === 'post' || event.kind === 'vote') flash('pleased')
    if (!r) return
    pullFace(r.expression)
    if (r.line) speak(r.line)
  }, [pullFace, speak, flash])

  // The month's counts: the mood, and the baseline for spotting a new post.
  const recount = useCallback(async () => {
    if (!cycle?.id) return
    const topics = await fetch(`/api/topics?cycle_id=${cycle.id}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
    if (!Array.isArray(topics)) return
    const now = Date.now()
    const daysSinceOpen = Math.max(0, Math.floor((now - new Date(cycle.opens_at ?? cycle.created_at).getTime()) / DAY))
    const daysToMeeting = cycle.meeting_at ? Math.ceil((new Date(cycle.meeting_at).getTime() - now) / DAY) : null
    const botPosts = topics.filter((t: { is_system?: boolean }) => t.is_system).length
    const humans = topics.length - botPosts
    const before = humanPosts.current
    humanPosts.current = humans

    // A new human post since we last counted. Our own was already reacted to.
    if (before !== null && humans > before) {
      const mine = selfPost.current && now - selfPost.current.at < 20_000
      if (mine) selfPost.current = null
      else react({ kind: 'post', mine: null, humanPostsBefore: before })
    }

    // The board sets his mood, but he has days: someone posting today makes
    // him proud, and a quiet month doesn't keep him bored every single day.
    const today = new Date().toDateString()
    const postedToday = topics.some((t: { is_system?: boolean; created_at?: string }) => !t.is_system && t.created_at && new Date(t.created_at).toDateString() === today)
    const board = moodFor({ daysSinceOpen, daysToMeeting, humanPosts: humans, botPosts })
    const next = moodOfDay(board, postedToday, daySeed(new Date(), 'mood'))
    moodRef.current = next
    setMood(next)
    setMoodLine(botSays(`mood.${next}`, `${cycle.id}:${today}`, 'ui', { posts: humans, days: daysSinceOpen }))

    if (before !== null) return
    // First count of this page: a visitor! Once a visit. The day after a
    // meeting, he'd rather hear how it went.
    const afterKey = `guildbot:after:${cycle.meeting_at}`
    if (meetingJustEnded(cycle.meeting_at, new Date()) && !localStorage.getItem(afterKey)) {
      later('arrive', 1800, () => { if (speak('meeting.after', { asked: true })) { localStorage.setItem(afterKey, '1'); pullFace('nosy') } })
    } else if (!sessionStorage.getItem(ARRIVED)) {
      sessionStorage.setItem(ARRIVED, '1')
      later('arrive', 1800, () => react({ kind: 'arrive' }))
    }
    // Once a week, he shows off. Once a day, small talk.
    const week = `guildbot:showcase:${isoWeek(new Date())}`
    if (!localStorage.getItem(week)) {
      later('showcase', 25_000, () => { if (speak('trick.showcase')) localStorage.setItem(week, '1') })
    }
    const day = `guildbot:talk:${new Date().toDateString()}`
    if (!localStorage.getItem(day)) {
      const t = TALK[Math.floor(now / DAY) % TALK.length]
      later('talk', 150_000, () => { if (speak(t.q, { chips: t.chips })) localStorage.setItem(day, '1') })
    }
  }, [cycle, react, speak, pullFace])

  useEffect(() => {
    const id = setTimeout(recount, 0)
    return () => clearTimeout(id)
  }, [recount])

  // The guild meeting: sulk while it's on, and say so once.
  useEffect(() => {
    const at = cycle?.meeting_at
    if (!at) return
    const check = () => {
      const on = meetingOn(at, new Date())
      setMeeting(on)
      const key = `guildbot:meeting:${at}`
      if (on && !localStorage.getItem(key) && speak('meeting.start', { asked: true, ms: 9000 })) {
        localStorage.setItem(key, '1')
        pullFace('grumpy')
      }
    }
    const first = setTimeout(check, 0)
    const id = setInterval(check, 30_000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [cycle?.meeting_at, speak, pullFace])

  useEffect(() => listen({
    live: (_channel, u) => {
      if (u.changed.includes('topics')) later('refetch', 700, recount)
      if (u.changed.includes('comments')) react({ kind: 'comment' })
      else if (u.changed.includes('poll')) react({ kind: 'poll' })
      else if (u.changed.includes('counts') && u.topic_id && u.counts) {
        const prev = votes.current.get(u.topic_id)
        votes.current.set(u.topic_id, u.counts.vote_count)
        if (prev === undefined || u.counts.vote_count > prev) react({ kind: 'vote' })
      }
    },
    presence: (_channel, count) => {
      const before = present.current
      present.current = count
      // The first count is just this tab joining: the arrival covers that.
      if (before > 0 && count !== before) react({ kind: 'presence', present: count, before })
    },
    self: e => {
      if (e.kind !== 'posted') return
      selfPost.current = { anonymous: e.anonymous, at: Date.now() }
      react({ kind: 'post', mine: e.anonymous ? 'ghost' : 'named', humanPostsBefore: humanPosts.current ?? 0 })
      if (humanPosts.current !== null) humanPosts.current += 1
    },
  }), [react, recount])

  // Something else wants him to say a line (the focus timer, at the end of a block).
  useEffect(() => {
    const onSay = (e: Event) => {
      const { key, vars } = (e as CustomEvent<{ key: LineKey; vars?: Record<string, string | number> }>).detail
      if (speak(key, { asked: true, ms: 9000, stay: true, vars })) pullFace(key === 'focus.done' || key === 'focus.party' ? 'excited' : 'proud')
      if (key === 'focus.done') flash('pleased')
    }
    window.addEventListener('gb:say', onSay)
    return () => window.removeEventListener('gb:say', onSay)
  }, [speak, pullFace, flash])

  useEffect(() => {
    const t = timers.current
    return () => Object.values(t).forEach(clearTimeout)
  }, [])

  /** Ask him for a trick. Returns the line he said, for the chat. */
  const doTrick = useCallback((kind: Trick): string | null => {
    const now = Date.now()
    const today = new Date().toDateString()
    const saved = JSON.parse(localStorage.getItem(ENERGY) ?? 'null') as { e: number; at: number; coffees: number; day: string } | null
    let e = saved ? Math.min(ENERGY_MAX, saved.e + Math.floor((now - saved.at) / ENERGY_REGEN_MS)) : ENERGY_MAX
    let coffees = saved?.day === today ? saved.coffees : 0
    let key: LineKey
    if (kind === 'coffee') {
      if (coffees >= COFFEES_PER_DAY) { key = 'trick.coffee.too_much'; pullFace('dramatic') }
      else { coffees += 1; e = Math.min(ENERGY_MAX, e + 2); key = 'trick.coffee'; pullFace('relieved') }
    } else if (e <= 0) {
      key = 'trick.tired'
      pullFace('sleepy')
    } else {
      e -= 1
      key = kind === 'dance' ? 'trick.dance' : kind === 'pat' ? 'trick.pat' : kind === 'walk' ? 'trick.walk' : 'trick.meditate'
      pullFace(kind === 'dance' ? 'excited' : kind === 'pat' ? 'proud' : 'relieved')
      if (kind === 'pat') flash('pleased')
      if (kind === 'dance' || kind === 'pat') {
        setTrick(kind)
        later('trick', kind === 'dance' ? 3200 : 1500, () => setTrick(null))
      }
      if (kind === 'walk') setPatrol(now)
    }
    localStorage.setItem(ENERGY, JSON.stringify({ e, at: now, coffees, day: today }))
    const text = botSays(key, `${key}:${now}`, 'ui')
    if (text) {
      sessionStorage.setItem(LAST_BUBBLE, String(now))
      setBubble({ id: now, text, stay: true })
      later('bubble', BUBBLE_MS, () => setBubble(null))
    }
    return text
  }, [pullFace, flash])

  /** Energy now, 0 to ENERGY_MAX, for his menu. */
  const energy = (): number => {
    const saved = JSON.parse(localStorage.getItem(ENERGY) ?? 'null') as { e: number; at: number } | null
    return saved ? Math.min(ENERGY_MAX, saved.e + Math.floor((Date.now() - saved.at) / ENERGY_REGEN_MS)) : ENERGY_MAX
  }

  const answer = (chip: Chip) => speak(chip.reply, { asked: true, stay: true })

  const endPatrol = useCallback(() => setPatrol(null), [])

  /** Say a line now (the weather, say), with a face to go with it. */
  const say = useCallback((key: LineKey, vars: Record<string, string | number>, face?: Expression) => {
    if (!speak(key, { asked: true, vars, stay: true })) return false
    if (face) pullFace(face)
    return true
  }, [speak, pullFace])

  /** His own walk, when the schedule says so: laps across the screen, back and forth. */
  const startWalk = useCallback(() => {
    if (prefsRef.current.hidden) return
    const key = `guildbot:walked:${new Date().toDateString()}:${new Date().getHours()}`
    // He says so once an hour; the laps carry on all walk long.
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      speak('walk.start', { stay: true })
    }
    setPatrol(p => p ?? Date.now())
  }, [speak])

  /** Asked for a walk while he's on his walk: no energy spent, he just says so. */
  const alreadyWalking = useCallback((): string | null => {
    setPatrol(p => p ?? Date.now())
    const now = Date.now()
    const text = botSays('trick.walk.already', `walk:${now}`, 'ui')
    if (text) {
      setBubble({ id: now, text, stay: true })
      later('bubble', BUBBLE_MS, () => setBubble(null))
    }
    return text
  }, [])

  const setQuiet = (on: boolean) => {
    if (on) localStorage.setItem(QUIET, new Date().toDateString()); else localStorage.removeItem(QUIET)
    setPrefs(p => ({ ...p, quiet: on }))
    if (on) setBubble(null)
  }
  const setHidden = (on: boolean) => {
    if (on) localStorage.setItem(HIDDEN, '1'); else localStorage.removeItem(HIDDEN)
    setPrefs(p => ({ ...p, hidden: on }))
    if (on) { setBubble(null); setReaction(null) }
  }

  return {
    mood,
    moodLine,
    /** The face right now: a live reaction, or the mood. */
    expression: (reaction ?? mood) as Expression,
    reacting: reaction !== null,
    bubble,
    dismissBubble: () => setBubble(null),
    answer,
    /** Changes each time a reaction lands: use as a key to replay the hop. */
    hop,
    /** His cursor state for a moment (click ripple, ⊘), and how to show one. */
    cursor,
    flash,
    trick,
    doTrick,
    patrol,
    endPatrol,
    /** Say a line now (the weather, say), with a face to go with it. */
    say,
    startWalk,
    alreadyWalking,
    energy,
    energyMax: ENERGY_MAX,
    meeting,
    quiet: prefs.quiet,
    hidden: prefs.hidden,
    setQuiet,
    setHidden,
  }
}
