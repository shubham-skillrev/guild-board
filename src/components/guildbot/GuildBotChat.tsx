'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { motion, useDragControls, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUp, ChartBar, ChatsCircle, Newspaper, PencilSimpleLine, Trash, X } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/Button'
import { KINDS, composeDescription } from '@/lib/kinds'
import { SASS, botSays } from '@/lib/guildbot-host/voice'
import { GuildBotMark } from '@/components/guildbot/GuildBotMark'
import { useActivity, type Asks as AsksState, type Scene } from '@/components/guildbot/GuildBotScene'
import { useFocusState, type BreakKind } from '@/lib/focus/store'
import { useRouter } from 'next/navigation'
import { GuildBotAvatar, type AvatarStatus } from '@/components/guildbot/GuildBotAvatar'
import { GuildBotStage, type Knock } from '@/components/guildbot/GuildBotStage'
import { BodyPortal } from '@/components/ui/BodyPortal'
import { useGuildBotLife } from '@/components/guildbot/useGuildBotLife'
import { announceSelf } from '@/lib/guildbot-host/live-bus'
import { welcomeKey, meetingWhen, isoWeek, type Expression } from '@guildboard/guildbot'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { useUserTokens } from '@/hooks/useUserTokens'
import { TOKEN_LIMITS } from '@/lib/constants'

const APRIL_KEY = 'guildbot:april-dodged'
/** What he does on screen during each focus-page break. */
const BREAK_SCENE: Record<BreakKind, Scene> = { water: 'coffee', eyes: 'meditating', stretch: 'waking', walk: 'walking' }

/** Things typed to him that he just does, locally. */
function localCommand(text: string): 'dance' | 'pat' | 'coffee' | 'meditate' | 'walk' | null {
  const t = text.toLowerCase().trim().replace(/[.!?]+$/, '')
  if (t.length > 40) return null
  if (/^(dance|do a dance|bust a move|show me a dance)\b/.test(t)) return 'dance'
  if (/^(good bot|pat|\*pats?\*|good job)\b/.test(t)) return 'pat'
  if (/^(have a coffee|coffee|here'?s a coffee|drink coffee)\b/.test(t)) return 'coffee'
  if (/^(meditate|let'?s meditate|breathe)\b/.test(t)) return 'meditate'
  if (/^(let'?s )?(take a )?(walk|break)\b|^(go for a walk)\b/.test(t)) return 'walk'
  return null
}

const PHASE_LABEL = { searching: 'Reading the board…', thinking: 'Thinking…', writing: 'Writing…' } as const
const DRAWER_W = 400

/** April 1st in India, once per browser session. */
function dodgeToday(): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Kolkata' }).formatToParts(new Date())
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return part('day') === 1 && part('month') === 4 && sessionStorage.getItem(APRIL_KEY) !== '1'
}

type Cite = { type: 'topic' | 'byte'; id: string; title: string }
type Draft = { kind: string; title: string; second: string; context: string; poll: { question: string; options: string[] } | null }
type Message = { id: string; role: 'user' | 'bot'; body: string; draft?: Draft | null; cites?: Cite[] | null; posted?: boolean }

/** Which page the chat is on, so the bot knows what "this topic" means. */
function pageOf(path: string): { kind: 'board' } | { kind: 'topic'; topicId: string } | { kind: 'bytes'; byteId?: string } | null {
  const topic = path.match(/^\/board\/([0-9a-f-]{36})/i)
  if (topic) return { kind: 'topic', topicId: topic[1] }
  if (path === '/board') return { kind: 'board' }
  const byte = path.match(/^\/bytes(?:\/([0-9a-f-]{36}))?/i)
  if (byte) return { kind: 'bytes', byteId: byte[1] }
  return null
}

/**
 * Chat with GuildBot, on the board, topic and Bytes pages. Signed-in members
 * only. The bot can answer from the board and Bytes, and draft a post, which
 * shows here as a card: nothing is posted until you press Post.
 *
 * The button is GuildBot's home (GuildBotHome), in the bottom-right corner
 * with the meeting pill stacked above it. The plate on the door is asks left
 * this week; in the last three the house becomes a genie's lamp and the chat
 * turns blue; with none left the lights are out and knocking only gets you a
 * line saying when they come back on. Tap it and you knock: the house rocks,
 * the door swings in, GuildBot peeks out, and the chat rolls open with a
 * greeting for its mood. From the keyboard, or with reduced motion, it just
 * opens. It opens:
 *  - on desktop, a full-height drawer on the right, next to the button. No
 *    dimming: the page stays scrollable and clickable, and moving to another
 *    topic keeps the chat open with the new topic as context.
 *  - on phones, a sheet covering 92% of the screen, over a dimmed sliver of
 *    the page. Drag it down or tap x to close. It sizes itself to the visible
 *    viewport, so the input stays above the keyboard.
 */
export function GuildBotChat({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname()
  const page = pageOf(pathname)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  // April 1st: the button hops away from the first click, once. The chat is
  // not a real action, so nothing anyone needs is ever in the way.
  const [dodge, setDodge] = useState<string | null>(null)
  // The knock: two raps, the door swings in, GuildBot answers in the doorway,
  // then he pulls the chat open. A second tap skips the rest.
  const [knock, setKnock] = useState<Knock>('idle')
  const [greeting, setGreeting] = useState<string | null>(null)
  // Out of asks: the window sputters and GuildBot says when it's back.
  const [lightsOut, setLightsOut] = useState<string | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const { asks, setAsks } = useAsks(signedIn)
  const activity = useActivity() ?? 'coding'
  const focusState = useFocusState()
  const router = useRouter()
  const welcome = useWelcome(pathname === '/board' && !open, signedIn)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()
  const life = useGuildBotLife()
  const { mood, moodLine } = life
  // What GuildBot is doing while you chat: the rings round him say it.
  const [focused, setFocused] = useState(false)
  const [phase, setPhase] = useState<'searching' | 'thinking' | 'writing'>('searching')
  const [talking, setTalking] = useState(false)
  const left = signedIn ? (asks?.left ?? null) : null
  const asksState: AsksState = left === 0 ? 'out' : left !== null && left <= 3 ? 'genie' : 'normal'
  const genie = asksState === 'genie'
  const outOfAsks = asksState === 'out'
  const desktop = useMediaQuery('(min-width: 768px)')
  // From 1280px the drawer docks: the page narrows by its width instead of
  // being covered, so nothing (like the share button) hides underneath it.
  const docked = useMediaQuery('(min-width: 1280px)')
  useEffect(() => {
    if (!open || !docked) return
    document.documentElement.style.setProperty('--gb-drawer-w', `${DRAWER_W}px`)
    return () => { document.documentElement.style.removeProperty('--gb-drawer-w') }
  }, [open, docked])
  const keyboard = useKeyboardInset(open && !desktop)
  const reduce = useReducedMotion()
  const drag = useDragControls()

  // Esc closes; phones lock the page behind the sheet, desktop does not.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    if (!desktop) document.body.style.overflow = 'hidden'
    if (desktop) inputRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, desktop])

  const load = useCallback(async () => {
    const res = await fetch('/api/guildbot/chat')
    if (res.ok) {
      const rows = await res.json()
      setMessages(rows.map((r: Message & { id: number }) => ({ ...r, id: String(r.id) })))
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (open && signedIn && !loaded) load()
  }, [open, signedIn, loaded, load])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  if (!SASS || !page) return null

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim()
    if (!text || thinking) return
    if (!preset) {
      setInput('')
      if (inputRef.current) inputRef.current.style.height = 'auto'
    }
    setMessages(m => [...m, { id: `local-${Date.now()}`, role: 'user', body: text }])
    // A few things he does himself, without spending an ask or a model call:
    // tricks and breaks. Not saved; gone on reload, like he promised.
    const local = localCommand(text)
    if (local) {
      const said = local === 'walk' ? botSays('break.walk', String(Date.now()), 'ui') : life.doTrick(local)
      setMessages(m => [...m, { id: `local-bot-${Date.now()}`, role: 'bot', body: said ?? 'Done.' }])
      if (local === 'walk') timers.current.push(setTimeout(() => router.push('/focus'), 900))
      return
    }
    setThinking(true)
    // The server reads the board, then asks a model, then writes: the rings
    // follow roughly those steps while we wait.
    setPhase('searching')
    const steps = [setTimeout(() => setPhase('thinking'), 1200), setTimeout(() => setPhase('writing'), 4500)]
    try {
      const res = await fetch('/api/guildbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, page }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        toast(data?.error ?? 'GuildBot did not answer. Try again.', 'error')
        return
      }
      setMessages(m => [...m, { id: `bot-${Date.now()}`, role: 'bot', body: data.reply, draft: data.draft, cites: data.cites }])
      if (data.asks) setAsks(data.asks)
      setTalking(true)
      timers.current.push(setTimeout(() => setTalking(false), 1800))
    } catch {
      toast('GuildBot did not answer, check your connection', 'error')
    } finally {
      steps.forEach(clearTimeout)
      setThinking(false)
    }
  }

  const status: AvatarStatus = thinking ? phase : talking ? 'talking' : focused && input.trim() ? 'listening' : 'idle'
  const expression: Expression = life.expression
  // What he's doing: the meeting beats everything, then a focus session you
  // started, then his own day.
  const scene: Scene = life.meeting
    ? 'meeting'
    : focusState.phase === 'focus' ? 'coding'
    : focusState.phase === 'break' && focusState.breakKind ? BREAK_SCENE[focusState.breakKind]
    : activity

  const press = (e: React.MouseEvent) => {
    if (open) { setOpen(false); return }
    // Impatient? A second tap during the knock skips straight to the chat.
    if (knock !== 'idle') { timers.current.forEach(clearTimeout); setKnock('idle'); setOpen(true); return }
    if (dodgeToday()) {
      sessionStorage.setItem(APRIL_KEY, '1')
      setDodge(botSays('egg.april', String(Date.now()), 'ui') ?? '')
      setTimeout(() => setDodge(null), 4000)
      return
    }
    if (outOfAsks) {
      const when = asks?.nextAt ? whenBack(asks.nextAt) : 'next week'
      setLightsOut(botSays('home.dark', `${asks?.nextAt}`, 'ui', { limit: asks?.limit ?? 15, when }) ?? `No asks left this week. Back ${when}.`)
      timers.current.push(setTimeout(() => setLightsOut(null), 5000))
      return
    }
    const left = asks?.left
    const seed = String(Date.now())
    setGreeting(
      life.meeting ? botSays('meeting.knock', seed, 'ui')
      : genie && left ? botSays(`home.genie.${left as 1 | 2 | 3}`, String(left), 'ui')
      : scene !== 'coding' && scene !== 'meeting' ? botSays(`home.knock.${scene}`, seed, 'ui')
      : botSays(`home.knock.${mood}`, seed, 'ui'),
    )
    // A keyboard press (detail 0) or reduced motion skips the knock.
    if (reduce || e.detail === 0) { setOpen(true); return }
    setKnock('knocking')
    timers.current.push(
      setTimeout(() => setKnock('door'), 480),
      setTimeout(() => { setKnock('idle'); setOpen(true) }, 1500),
    )
  }

  const clear = async () => {
    if (!window.confirm('Clear your chat with GuildBot?')) return
    await fetch('/api/guildbot/chat', { method: 'DELETE' })
    setMessages([])
  }

  return (
    <BodyPortal>
      {SASS && (
        <GuildBotStage
          scene={scene}
          asks={asksState}
          left={left}
          expression={expression}
          reacting={life.reacting}
          hop={life.hop}
          bubble={life.bubble}
          onDismissBubble={life.dismissBubble}
          onChip={life.answer}
          trick={life.trick}
          onTrick={t => life.doTrick(t)}
          energy={() => ({ now: life.energy(), max: life.energyMax })}
          knock={knock}
          greeting={greeting}
          lightsOut={lightsOut}
          open={open}
          desktop={desktop}
          drawerWidth={DRAWER_W}
          phoneSheetBottom={`calc(${keyboard.height} + ${keyboard.inset}px - 6px)`}
          status={status}
          hidden={life.hidden}
          quiet={life.quiet}
          onQuiet={() => life.setQuiet(!life.quiet)}
          onHide={on => life.setHidden(on)}
          reduce={!!reduce}
          dodge={dodge}
          label={homeLabel(signedIn ? asks : null)}
          onPress={press}
        />
      )}

      {welcome.text && !open && !dodge && !lightsOut && !life.bubble && knock === 'idle' && (
        <WelcomeCard text={welcome.text} onOpen={() => { welcome.dismiss(); setOpen(true) }} onDismiss={welcome.dismiss} />
      )}

      {open && (
        <>
          {/* Phones only: dim the sliver of page above the sheet; tap it to close. */}
          {!desktop && <div aria-hidden className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />}
          <motion.section
            role="dialog"
            aria-label="Chat with GuildBot"
            aria-modal={!desktop}
            initial={reduce ? { opacity: 0 } : desktop ? { x: '100%' } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : desktop ? { x: 0 } : { y: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            drag={desktop ? false : 'y'}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) setOpen(false) }}
            style={desktop ? undefined : { bottom: keyboard.inset, height: keyboard.height }}
            className={cn(
              // Its own surface: a raised panel with a firm edge and a cast
              // shadow, so it never reads as part of the page beside it.
              'fixed z-50 flex flex-col overflow-hidden bg-paper border-border-strong',
              desktop
                ? 'top-0 right-0 bottom-0 w-[400px] border-l shadow-[-20px_0_48px_-16px_rgba(0,0,0,0.45)]'
                : 'inset-x-0 rounded-t-2xl border-t shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.4)]',
            )}
          >
            {!reduce && (
              // The roller shutter: slats over the panel that roll away as it
              // arrives, sideways into the dock on desktop, up on phones.
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background: `repeating-linear-gradient(${desktop ? '90deg' : '180deg'}, ${genie ? 'var(--color-indigo-light)' : 'var(--color-kinu)'} 0 9px, ${genie ? 'var(--color-indigo-jp)' : 'var(--color-border-strong)'} 9px 10px)`,
                  transformOrigin: desktop ? '100% 50%' : '50% 0%',
                }}
                initial={{ transform: desktop ? 'scaleX(1)' : 'scaleY(1)' }}
                animate={{ transform: desktop ? 'scaleX(0)' : 'scaleY(0)' }}
                transition={{ duration: 0.28, delay: 0.14, ease: [0.32, 0.72, 0, 1] }}
              />
            )}
            {!desktop && (
              // Grab handle: drag the sheet down to close it.
              <div onPointerDown={e => drag.start(e)} className="flex justify-center pt-2.5 pb-1 touch-none cursor-grab">
                <span className="h-1 w-10 rounded-full bg-border-strong" />
              </div>
            )}
            <header
              onPointerDown={e => { if (!desktop) drag.start(e) }}
              className={cn('flex items-center gap-3 px-4 border-b border-border', desktop ? 'h-16' : 'pb-3 touch-none')}
            >
              <GuildBotAvatar expression={expression} status={status} size={38} feet={false} genie={genie} className="mx-1" />
              <div className="min-w-0">
                <h2 className="text-footnote font-semibold text-ink">
                  GuildBot
                  {signedIn && asks && (
                    <span className={cn('ml-2 font-normal text-caption tabular-nums', genie ? 'text-indigo-jp' : 'text-cha')}>
                      {genie ? `${asks.left} ${asks.left === 1 ? 'wish' : 'wishes'} left` : `${asks.left} ${asks.left === 1 ? 'ask' : 'asks'} left`}
                    </span>
                  )}
                </h2>
                <p className="text-caption text-cha truncate">{thinking ? PHASE_LABEL[phase] : greeting ?? moodLine ?? 'Knows the board and Bytes'}</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                {life.hidden && (
                  <button type="button" onClick={() => life.setHidden(false)} className="px-2 h-8 rounded-full text-caption text-cha hover:text-ink hover:bg-kinu/60">
                    Bring back antics
                  </button>
                )}
                {signedIn && messages.length > 0 && (
                  <button type="button" onClick={clear} aria-label="Clear chat" title="Clear chat" className="p-2 rounded-full text-cha hover:text-ink hover:bg-kinu/60">
                    <Trash className="w-4 h-4" />
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="p-2 rounded-full text-cha hover:text-ink hover:bg-kinu/60">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {!signedIn ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-footnote text-ink-soft">Sign in to chat with GuildBot.</p>
                <Link href="/login" className="text-footnote text-saffron hover:underline">Sign in</Link>
              </div>
            ) : (
              <>
                {/* A recessed well behind the conversation, darker than the header
                    and composer, so the three zones read apart without colour. */}
                <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-5 bg-sumi" aria-live="polite">
                  {loaded && messages.length === 0 && (
                    <div className="space-y-4">
                      <BotRow mood={expression}>
                        <p className="rounded-2xl rounded-tl-md border border-border bg-paper px-3.5 py-2.5 text-footnote leading-relaxed text-ink">
                          Ask me about this month&apos;s topics or Bytes, or give me an idea and I&apos;ll draft the post. You press Post.
                        </p>
                      </BotRow>
                      <div className="flex flex-wrap gap-2 pl-9">
                        {suggestionsFor(page).map(q => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => send(q)}
                            className="press rounded-full border border-border bg-paper px-3 h-8 text-footnote text-ink-soft hover:border-border-strong hover:text-ink"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                      <p className="pl-9 text-caption text-cha leading-relaxed">
                        {`${asks?.limit ?? 15} asks a week. On meeting day I share anonymous themes from everyone's chats in Slack, never who asked what, then delete every chat.`}
                      </p>
                    </div>
                  )}
                  {messages.map(m => (
                    <ChatBubble
                      key={m.id}
                      message={m}
                      mood={expression}
                      onPosted={() => setMessages(list => list.map(x => (x.id === m.id ? { ...x, posted: true } : x)))}
                    />
                  ))}
                  {thinking && (
                    <BotRow mood={expression}>
                      <p role="status" className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-paper px-3.5 h-9 text-caption text-cha">
                        {PHASE_LABEL[phase]}
                      </p>
                    </BotRow>
                  )}
                </div>

                <form
                  onSubmit={e => { e.preventDefault(); send() }}
                  className="bg-paper border-t border-border px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                >
                  {/* One field with the send button inside it, the shape every
                      chat app has taught people to read as "type here". */}
                  {/* The text line is exactly the button's 32px, so on one line
                      they share a centre; as the text grows the button stays on
                      the last line (items-end). */}
                  <div className="flex items-end gap-2 rounded-2xl border border-border bg-sumi pl-3.5 pr-1.5 py-1.5 transition-colors focus-within:border-border-strong focus-within:bg-paper">
                    <textarea
                      ref={inputRef}
                      disabled={outOfAsks}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      value={input}
                      onChange={e => {
                        setInput(e.target.value)
                        const el = e.target
                        el.style.height = 'auto'
                        el.style.height = `${Math.min(el.scrollHeight, 168)}px`
                      }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                      rows={1}
                      maxLength={1500}
                      placeholder={outOfAsks ? `Out of asks. Back ${asks?.nextAt ? whenBack(asks.nextAt) : 'next week'}.` : genie ? 'Make a wish…' : 'Ask GuildBot…'}
                      aria-label="Message GuildBot"
                      // 16px on phones: smaller text makes iOS zoom the page on focus.
                      className="flex-1 min-w-0 resize-none bg-transparent py-1 min-h-8 text-[16px] leading-6 md:text-[14px] text-ink placeholder:text-cha focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || thinking}
                      aria-label="Send"
                      className={cn(
                        'press shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                        input.trim() && !thinking
                          ? genie ? 'bg-indigo-jp text-white hover:bg-indigo-jp/90' : 'bg-saffron text-parchment hover:bg-saffron/90'
                          : 'bg-fill text-cha',
                      )}
                    >
                      <ArrowUp className="w-4 h-4" weight="bold" />
                    </button>
                  </div>
                  <p className="hidden md:block mt-1.5 px-1 text-caption text-cha">Enter to send · Shift + Enter for a new line</p>
                </form>
              </>
            )}
          </motion.section>
        </>
      )}
    </BodyPortal>
  )
}

/** A bot turn: GuildBot's face beside whatever it said. */
function BotRow({ mood, children }: { mood: Expression; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <GuildBotAvatar expression={mood} size={28} feet={false} className="mt-0.5" />
      <div className="min-w-0 flex-1 flex flex-col items-start gap-2">{children}</div>
    </div>
  )
}

function ChatBubble({ message, mood, onPosted }: { message: Message; mood: Expression; onPosted: () => void }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-fill border border-border px-3.5 py-2.5 text-footnote leading-relaxed text-ink">
          {message.body}
        </p>
      </div>
    )
  }
  return (
    <BotRow mood={mood}>
      <p className="max-w-full whitespace-pre-wrap rounded-2xl rounded-tl-md border border-border bg-paper px-3.5 py-2.5 text-footnote leading-relaxed text-ink">
        {message.body}
      </p>
      {!!message.cites?.length && (
        <div className="flex flex-wrap gap-1.5 max-w-full">
          {message.cites.map(c => (
            <Link
              key={c.id}
              href={c.type === 'topic' ? `/board/${c.id}` : `/bytes/${c.id}`}
              className="inline-flex items-center gap-1 h-6 max-w-full rounded-full border border-border bg-paper px-2 text-[11px] text-ink-soft hover:border-border-strong hover:text-ink"
            >
              {c.type === 'byte' ? <Newspaper className="w-3 h-3 shrink-0" /> : <ChatsCircle className="w-3 h-3 shrink-0" />}
              <span className="truncate">{c.title}</span>
            </Link>
          ))}
        </div>
      )}
      {message.draft && <DraftCard draft={message.draft} posted={!!message.posted} onPosted={onPosted} />}
    </BotRow>
  )
}

/** Conversation starters for an empty chat, tuned to the page. */
function suggestionsFor(page: NonNullable<ReturnType<typeof pageOf>>): string[] {
  if (page.kind === 'topic') return ['Summarise this discussion', "What's the other side of this?", 'Draft a follow-up post']
  if (page.kind === 'bytes') return ["What's worth reading in Bytes?", 'Anything here about AI?', 'Draft a post from a story']
  return ["What's hot this month?", "Draft a post for this month's theme", "What's in Bytes?"]
}

/** A post GuildBot drafted. Nothing goes on the board until you press Post. */
function DraftCard({ draft, posted, onPosted }: { draft: Draft; posted: boolean; onPosted: () => void }) {
  const [ghost, setGhost] = useState(false)
  const [pending, setPending] = useState(false)
  const [topicId, setTopicId] = useState<string | null>(null)
  const toast = useToast()
  const kind = KINDS.find(k => k.value === draft.kind)
  if (!kind) return null

  const post = async () => {
    setPending(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          description: composeDescription(kind, draft.second, draft.context),
          category: kind.value,
          is_anonymous: ghost,
          poll: draft.poll,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast(data.error ?? 'Could not post. Try again.', 'error'); return }
      setTopicId(data.id ?? null)
      announceSelf({ kind: 'posted', anonymous: ghost })
      onPosted()
      toast('Posted to the board', 'success')
    } catch {
      toast('Could not post, check your connection', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="w-full rounded-(--radius-card) border border-border-strong bg-paper overflow-hidden">
      <p className="flex items-center gap-1.5 px-3.5 py-2 border-b border-border text-caption text-ink-soft">
        <PencilSimpleLine className="w-3.5 h-3.5" />
        Draft · {kind.label}
      </p>
      <div className="px-3.5 py-3 space-y-1.5">
        <p className="text-footnote font-semibold leading-snug text-ink">{draft.title}</p>
        <p className="text-caption leading-relaxed text-ink-soft"><span className="text-cha">{kind.second.label} </span>{draft.second}</p>
        {draft.context && <p className="text-caption leading-relaxed text-ink-soft"><span className="text-cha">Context </span>{draft.context}</p>}
        {draft.poll && (
          <p className="inline-flex items-center gap-1 text-caption text-cha">
            <ChartBar className="w-3.5 h-3.5" /> Poll: {draft.poll.question} ({draft.poll.options.join(' / ')})
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-border">
        {posted || topicId ? (
          <p className="text-caption text-matcha">
            Posted.{topicId && <> <Link href={`/board/${topicId}`} className="underline">Open it</Link></>}
          </p>
        ) : (
          <>
            <label className="inline-flex items-center gap-1.5 text-caption text-ink-soft cursor-pointer select-none">
              <input type="checkbox" checked={ghost} onChange={e => setGhost(e.target.checked)} className="accent-ink" />
              Post anonymously
            </label>
            <Button size="sm" className="ml-auto" onClick={post} disabled={pending}>
              {pending ? 'Posting…' : 'Post'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

const WELCOME_DELAY_MS = 1200
const WELCOME_VISIBLE_MS = 12_000

/**
 * The bubble above the chat button on the board: one line a week, chosen by
 * the situation (theme, whether you have posted, how close the meeting is).
 * Shown the first time you open the board in a week, and again if your
 * situation changes that week (say, you post). Tapping it opens the chat.
 */
function useWelcome(active: boolean, signedIn: boolean) {
  const { cycle, phase, isLoading } = useCurrentCycle()
  const tokens = useUserTokens(cycle?.id)
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    if (!active || isLoading || tokens.isLoading || !cycle) return
    const now = new Date()
    const days = cycle.meeting_at ? Math.ceil((new Date(cycle.meeting_at).getTime() - now.getTime()) / 86_400_000) : null
    const key = welcomeKey({
      signedIn,
      phase,
      postsUsed: TOKEN_LIMITS.TOPICS_PER_CYCLE - tokens.topics_remaining,
      postsAllowed: TOKEN_LIMITS.TOPICS_PER_CYCLE,
      daysToMeeting: days,
      hasTheme: !!cycle.theme?.name,
    })
    const week = isoWeek(now)
    const storageKey = `guildbot:welcome:${week}:${key}`
    if (localStorage.getItem(storageKey)) return

    const line = botSays(key, `${week}:${cycle.id}`, 'ui', {
      ...(cycle.theme?.name ? { theme: cycle.theme.name } : {}),
      ...(days !== null ? { when: meetingWhen(days) } : {}),
    })
    if (!line) return

    const show = setTimeout(() => {
      // An install or push prompt is a one-time ask and wins the bottom of the
      // screen. Skip without marking as seen, so the bubble shows next visit.
      if (document.querySelector('[data-floating-prompt]')) return
      localStorage.setItem(storageKey, '1')
      setText(line)
    }, WELCOME_DELAY_MS)
    const hide = setTimeout(() => setText(null), WELCOME_DELAY_MS + WELCOME_VISIBLE_MS)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [active, isLoading, tokens.isLoading, tokens.topics_remaining, cycle, phase, signedIn])

  return { text: active ? text : null, dismiss: () => setText(null) }
}

/**
 * The welcome line, as a small chat card above the button: GuildBot's face and
 * name, the line, and a tail pointing down at the button. While it is up it
 * publishes its height as --gb-bubble-h on <body>, so the meeting pill (which
 * also lives above the button) can step up over it instead of overlapping.
 */
function WelcomeCard({ text, onOpen, onDismiss }: { text: string; onOpen: () => void; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const publish = () => document.body.style.setProperty('--gb-bubble-h', `${el.offsetHeight + 12}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.body.style.removeProperty('--gb-bubble-h')
    }
  }, [])

  return (
    <div
      ref={ref}
      role="status"
      // Just above the house: 5.25rem + ~4.4rem on a phone, 0.75rem + ~5rem on md.
      className="fixed right-4 bottom-[10.25rem] md:right-6 md:bottom-[6.5rem] z-(--z-overlay) w-[min(18rem,calc(100vw-2rem))] animate-fade-up"
    >
      <div className="relative rounded-(--radius-card) border border-border bg-paper shadow-lg">
        <button type="button" onClick={onOpen} className="block w-full text-left px-3.5 pt-3 pb-3">
          <span className="flex items-center gap-2 pr-6">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sumi border border-border text-ink">
              <GuildBotMark size={16} />
            </span>
            <span className="text-footnote text-ink">GuildBot</span>
          </span>
          <span className="mt-1.5 block text-[13px] leading-snug text-ink-soft">{text}</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute top-2 right-2 p-1 rounded-full text-cha hover:text-ink hover:bg-kinu/60"
        >
          <X className="w-3 h-3" />
        </button>
        {/* Tail, pointing down at the middle of the home. */}
        <span aria-hidden className="absolute -bottom-1.5 right-[26px] h-3 w-3 rotate-45 border-r border-b border-border bg-paper" />
      </div>
    </div>
  )
}

/** True while a media query matches; false on the server and during hydration. */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    cb => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * Where the phone sheet should sit: 92% of the visible viewport, lifted above
 * the on-screen keyboard. iOS does not shrink dvh for the keyboard, so this
 * reads window.visualViewport instead.
 */
function useKeyboardInset(active: boolean): { inset: number; height: string } {
  const [state, setState] = useState({ inset: 0, height: '92dvh' })
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setState(inset > 0 ? { inset, height: `${Math.round(vv.height - 8)}px` } : { inset: 0, height: '92dvh' })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])
  return active ? state : { inset: 0, height: '92dvh' }
}

type Asks = { left: number; limit: number; nextAt: string | null }

/**
 * Asks left this week, for the door plate. Fetched on load and whenever the
 * tab comes back into focus (an old ask may have aged out meanwhile); the chat
 * replaces it with the count each reply comes back with.
 */
function useAsks(signedIn: boolean) {
  const [asks, setAsks] = useState<Asks | null>(null)
  useEffect(() => {
    if (!SASS || !signedIn) return
    let cancelled = false
    const load = () =>
      fetch('/api/guildbot/asks')
        .then(r => (r.ok ? r.json() : null))
        .then((a: Asks | null) => { if (!cancelled && a) setAsks(a) })
        .catch(() => {})
    load()
    window.addEventListener('focus', load)
    return () => { cancelled = true; window.removeEventListener('focus', load) }
  }, [signedIn])
  return { asks, setAsks }
}

/** "today at 2 pm", "tomorrow at 9 am", "on Thursday at 2 pm", in the viewer's time zone. */
function whenBack(iso: string): string {
  const at = new Date(iso)
  const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  const time = at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: at.getMinutes() ? '2-digit' : undefined, hour12: true })
  const day = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `on ${at.toLocaleDateString('en-GB', { weekday: 'long' })}`
  return `${day} at ${time}`
}

/** What a screen reader hears for the home, including the plate. */
function homeLabel(asks: Asks | null): string {
  if (!asks) return 'Chat with GuildBot'
  if (asks.left === 0) return 'GuildBot, no asks left this week'
  return `Chat with GuildBot, ${asks.left} ${asks.left === 1 ? 'ask' : 'asks'} left this week`
}
