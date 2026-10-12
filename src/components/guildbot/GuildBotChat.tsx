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
import { BodyPortal } from '@/components/ui/BodyPortal'
import { useGuildBotMood } from '@/components/guildbot/useGuildBotMood'
import { welcomeKey, meetingWhen, isoWeek, type Mood } from '@guildboard/guildbot'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { useUserTokens } from '@/hooks/useUserTokens'
import { TOKEN_LIMITS } from '@/lib/constants'

const APRIL_KEY = 'guildbot:april-dodged'
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
 * The button sits in the bottom-right corner (the meeting pill stacks above
 * it) and wears the bot's current mood. It opens:
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
  const welcome = useWelcome(pathname === '/board' && !open, signedIn)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()
  const { mood, line: moodLine } = useGuildBotMood()
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
    setThinking(true)
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
    } catch {
      toast('GuildBot did not answer, check your connection', 'error')
    } finally {
      setThinking(false)
    }
  }

  const clear = async () => {
    if (!window.confirm('Clear your chat with GuildBot?')) return
    await fetch('/api/guildbot/chat', { method: 'DELETE' })
    setMessages([])
  }

  return (
    <BodyPortal>
      <button
        type="button"
        onClick={() => {
          if (!open && dodgeToday()) {
            sessionStorage.setItem(APRIL_KEY, '1')
            setDodge(botSays('egg.april', String(Date.now()), 'ui') ?? '')
            setTimeout(() => setDodge(null), 4000)
            return
          }
          setOpen(o => !o)
        }}
        aria-expanded={open}
        aria-label="Chat with GuildBot"
        className={cn(
          'press fixed right-4 bottom-24 md:right-6 md:bottom-6 z-(--z-overlay) inline-flex items-center justify-center gap-2 h-12 w-12 md:h-11 md:w-auto md:pl-3 md:pr-4 rounded-full bg-ink text-parchment shadow-lg hover:bg-ink/90 transition-[transform,background-color] duration-300 motion-reduce:transition-none',
          dodge !== null && '-translate-x-24 -translate-y-16',
          // The drawer or sheet has its own close; the button would only sit on top of it.
          open && 'hidden',
        )}
      >
        <GuildBotMark size={22} mood={mood} />
        {/* Just the face on a phone: the full pill would cover the cards. */}
        <span className="hidden md:inline text-[13px] font-medium">Ask GuildBot</span>
      </button>

      {welcome.text && !open && !dodge && (
        <WelcomeCard text={welcome.text} onOpen={() => { welcome.dismiss(); setOpen(true) }} onDismiss={welcome.dismiss} />
      )}

      {dodge && (
        <p role="status" className="fixed right-4 bottom-38 md:right-6 md:bottom-20 z-50 max-w-xs inline-flex items-start gap-1.5 rounded-(--radius-card) border border-border-strong bg-paper px-3 py-2 text-[12px] text-ink shadow-lg animate-fade-up">
          <GuildBotMark size={16} className="text-ink mt-px" />{dodge}
        </p>
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
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-sumi border border-border text-ink shrink-0">
                <GuildBotMark size={22} mood={mood} />
              </span>
              <div className="min-w-0">
                <h2 className="text-footnote font-semibold text-ink">GuildBot</h2>
                <p className="text-caption text-cha truncate">{moodLine ?? 'Knows the board and Bytes'}</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
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
                      <BotRow mood={mood}>
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
                        15 asks a week. On meeting day I share anonymous themes from everyone&apos;s chats in Slack, never who asked what, then delete every chat.
                      </p>
                    </div>
                  )}
                  {messages.map(m => (
                    <ChatBubble
                      key={m.id}
                      message={m}
                      mood={mood}
                      onPosted={() => setMessages(list => list.map(x => (x.id === m.id ? { ...x, posted: true } : x)))}
                    />
                  ))}
                  {thinking && (
                    <BotRow mood={mood}>
                      <p role="status" className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-paper px-3.5 h-9 text-caption text-cha">
                        GuildBot is typing<span className="animate-pulse">…</span>
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
                      placeholder="Ask GuildBot…"
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
                        input.trim() && !thinking ? 'bg-saffron text-parchment hover:bg-saffron/90' : 'bg-fill text-cha',
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
function BotRow({ mood, children }: { mood: Mood; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-paper border border-border text-ink">
        <GuildBotMark size={18} mood={mood} />
      </span>
      <div className="min-w-0 flex-1 flex flex-col items-start gap-2">{children}</div>
    </div>
  )
}

function ChatBubble({ message, mood, onPosted }: { message: Message; mood: Mood; onPosted: () => void }) {
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
      // Just above the button: 6rem + 3rem button on a phone, 1.5rem + 2.75rem on md.
      className="fixed right-4 bottom-[9.5rem] md:right-6 md:bottom-[5rem] z-(--z-overlay) w-[min(18rem,calc(100vw-2rem))] animate-fade-up"
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
        {/* Tail, pointing down at the button. */}
        <span aria-hidden className="absolute -bottom-1.5 right-5 h-3 w-3 rotate-45 border-r border-b border-border bg-paper" />
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
