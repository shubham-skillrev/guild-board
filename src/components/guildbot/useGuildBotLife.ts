'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { moodFor, reactTo, type BoardEvent, type Expression, type LineKey, type Mood } from '@guildboard/guildbot'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { botSays, SASS } from '@/lib/guildbot-host/voice'
import { listen } from '@/lib/guildbot-host/live-bus'

const DAY = 86_400_000
/** How long a reaction's face holds before GuildBot settles back into its mood. */
const REACTION_MS = 8000
/** At most one speech bubble this often, across pages (sessionStorage). */
const BUBBLE_GAP_MS = 2 * 60_000
const BUBBLE_MS = 6500
const LAST_BUBBLE = 'guildbot:last-bubble'
const QUIET = 'guildbot:quiet'
const HIDDEN = 'guildbot:hidden'
const ARRIVED = 'guildbot:arrived'

export interface Bubble { id: number; text: string; big: boolean }

/**
 * GuildBot being alive on the page: its mood from this month's counts, kept
 * current as the board changes, and its reactions to what happens live
 * (react.ts in the package: the rules, tested).
 *
 * Hears the board through the page's own live channel (live-bus.ts), and the
 * viewer's own posts. Counts only, so it names nobody, and a ghost's post is
 * reacted to exactly like a stranger's.
 *
 * Two switches, per device: quiet for today (faces, no speech bubbles) and
 * hidden (no antics at all: the house stays, as the chat button).
 */
export function useGuildBotLife() {
  const { cycle } = useCurrentCycle()
  const [mood, setMood] = useState<Mood>('smug')
  const [moodLine, setMoodLine] = useState<string | null>(null)
  const [reaction, setReaction] = useState<Expression | null>(null)
  const [bubble, setBubble] = useState<Bubble | null>(null)
  const [hop, setHop] = useState(0)
  const [prefs, setPrefs] = useState({ quiet: false, hidden: false })

  const humanPosts = useRef<number | null>(null)
  const moodRef = useRef<Mood>('smug')
  const recent = useRef<number[]>([])
  const votes = useRef(new Map<string, number>())
  const present = useRef(0)
  const selfPost = useRef<{ anonymous: boolean; at: number } | null>(null)
  const timers = useRef<{ reaction?: ReturnType<typeof setTimeout>; bubble?: ReturnType<typeof setTimeout>; refetch?: ReturnType<typeof setTimeout>; arrive?: ReturnType<typeof setTimeout> }>({})
  const prefsRef = useRef(prefs)
  useEffect(() => { prefsRef.current = prefs }, [prefs])

  useEffect(() => {
    const today = new Date().toDateString()
    const id = setTimeout(() => setPrefs({ quiet: localStorage.getItem(QUIET) === today, hidden: localStorage.getItem(HIDDEN) === '1' }), 0)
    return () => clearTimeout(id)
  }, [])

  const react = useCallback((event: BoardEvent) => {
    if (!SASS || prefsRef.current.hidden) return
    const now = Date.now()
    recent.current = recent.current.filter(t => now - t < 60_000)
    const r = reactTo(event, { mood: moodRef.current, recent: recent.current.length, hour: new Date().getHours() })
    recent.current.push(now)
    if (!r) return

    setReaction(r.expression)
    setHop(h => h + 1)
    clearTimeout(timers.current.reaction)
    timers.current.reaction = setTimeout(() => setReaction(null), REACTION_MS)

    if (!r.line || prefsRef.current.quiet) return
    const last = Number(sessionStorage.getItem(LAST_BUBBLE) ?? 0)
    if (now - last < BUBBLE_GAP_MS) return
    const text = botSays(r.line as LineKey, `${r.line}:${Math.floor(now / 60_000)}`, 'ui', { present: present.current })
    if (!text) return
    sessionStorage.setItem(LAST_BUBBLE, String(now))
    setBubble({ id: now, text, big: true })
    clearTimeout(timers.current.bubble)
    timers.current.bubble = setTimeout(() => setBubble(null), BUBBLE_MS)
  }, [])

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

    const next = moodFor({ daysSinceOpen, daysToMeeting, humanPosts: humans, botPosts })
    moodRef.current = next
    setMood(next)
    setMoodLine(botSays(`mood.${next}`, cycle.id, 'ui', { posts: humans, days: daysSinceOpen }))

    // A visitor! Once a visit, a moment after the page settles: GuildBoard is
    // his home, and attention is his favourite thing.
    if (before === null && !sessionStorage.getItem(ARRIVED)) {
      sessionStorage.setItem(ARRIVED, '1')
      timers.current.arrive = setTimeout(() => react({ kind: 'arrive' }), 1800)
    }
  }, [cycle, react])

  useEffect(() => {
    const id = setTimeout(recount, 0)
    return () => clearTimeout(id)
  }, [recount])

  useEffect(() => listen({
    live: (_channel, u) => {
      if (u.changed.includes('topics')) {
        clearTimeout(timers.current.refetch)
        timers.current.refetch = setTimeout(recount, 700)
      }
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

  useEffect(() => {
    const t = timers.current
    return () => { clearTimeout(t.reaction); clearTimeout(t.bubble); clearTimeout(t.refetch); clearTimeout(t.arrive) }
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
    /** Changes each time a reaction lands: use as a key to replay the hop. */
    hop,
    quiet: prefs.quiet,
    hidden: prefs.hidden,
    setQuiet,
    setHidden,
  }
}
