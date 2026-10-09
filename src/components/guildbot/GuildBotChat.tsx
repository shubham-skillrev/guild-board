'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartBar, PaperPlaneRight, Trash, X } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/Button'
import { KINDS, composeDescription } from '@/lib/kinds'
import { SASS, botSays } from '@/lib/guildbot-host/voice'
import { GuildBotMark } from '@/components/guildbot/GuildBotMark'
import { BodyPortal } from '@/components/guildbot/BodyPortal'

const APRIL_KEY = 'guildbot:april-dodged'

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
 * Chat with GuildBot, on the board, topic and Bytes pages. Fixed to the
 * bottom-right corner; the meeting countdown pill stacks just above it. Signed-in members
 * only. The bot can answer from the board and Bytes, and draft a post, which
 * shows here as a card: nothing is posted until you press Post.
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
  const listRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

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

  const send = async () => {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')
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
        aria-label={open ? 'Close GuildBot chat' : 'Chat with GuildBot'}
        className={cn(
          'press fixed right-4 bottom-24 md:right-6 md:bottom-6 z-(--z-overlay) inline-flex items-center justify-center gap-2 h-12 w-12 md:h-11 md:w-auto md:pl-3 md:pr-4 rounded-full bg-ink text-parchment shadow-lg hover:bg-ink/90 transition-[transform,background-color] duration-300 motion-reduce:transition-none',
          dodge !== null && '-translate-x-24 -translate-y-16',
        )}
      >
        <GuildBotMark size={22} />
        {/* Just the face on a phone: the full pill would cover the cards. */}
        <span className="hidden md:inline text-[13px] font-medium">{open ? 'Close' : 'Ask GuildBot'}</span>
      </button>

      {dodge && (
        <p role="status" className="fixed right-4 bottom-38 md:right-6 md:bottom-20 z-50 max-w-xs inline-flex items-start gap-1.5 rounded-(--radius-card) border border-saffron/40 bg-paper px-3 py-2 text-[12px] text-ink shadow-lg animate-fade-up">
          <GuildBotMark size={16} className="text-ink mt-px" />{dodge}
        </p>
      )}

      {open && (
        <section
          aria-label="Chat with GuildBot"
          className="fixed right-4 bottom-38 md:right-6 md:bottom-20 z-50 flex flex-col w-[min(380px,calc(100vw-2rem))] h-[min(560px,65vh)] bg-paper border border-border rounded-(--radius-card) shadow-2xl animate-fade-up"
        >
          <header className="flex items-center gap-2 px-4 h-12 border-b border-border">
            <GuildBotMark size={20} className="text-ink" />
            <h2 className="text-[14px] font-semibold text-ink">GuildBot</h2>
            <span className="text-[11px] text-cha">Knows the board and Bytes</span>
            <div className="ml-auto flex items-center gap-1">
              {signedIn && messages.length > 0 && (
                <button type="button" onClick={clear} aria-label="Clear chat" title="Clear chat" className="p-1.5 rounded-full text-cha hover:text-ink hover:bg-kinu/60">
                  <Trash className="w-3.5 h-3.5" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-full text-cha hover:text-ink hover:bg-kinu/60">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {!signedIn ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[13px] text-ink-soft">Sign in to chat with GuildBot.</p>
              <Link href="/login" className="text-[13px] text-saffron hover:underline">Sign in</Link>
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
                {loaded && messages.length === 0 && (
                  <p className="text-[13px] text-cha leading-relaxed">
                    Ask about this month&apos;s topics or Bytes, or tell me an idea and ask me to draft it as a post. 15 asks a week. On meeting day I share anonymous themes from everyone&apos;s chats in Slack, never who asked what, then delete every chat.
                  </p>
                )}
                {messages.map(m => (
                  <ChatBubble
                    key={m.id}
                    message={m}
                    onPosted={() => setMessages(list => list.map(x => (x.id === m.id ? { ...x, posted: true } : x)))}
                  />
                ))}
                {thinking && (
                  <p role="status" className="inline-flex items-center gap-1.5 text-[12px] text-cha">
                    <GuildBotMark size={16} className="text-ink-soft" />
                    GuildBot is typing<span className="animate-pulse">…</span>
                  </p>
                )}
              </div>

              <form
                onSubmit={e => { e.preventDefault(); send() }}
                className="flex items-end gap-2 p-3 border-t border-border"
              >
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  rows={1}
                  maxLength={1500}
                  placeholder="Ask GuildBot…"
                  aria-label="Message GuildBot"
                  className="flex-1 max-h-28 resize-none bg-sumi rounded-(--radius-control) px-3 py-2 text-[13px] text-ink placeholder:text-cha focus:outline-none focus:bg-paper border border-transparent focus:border-border-strong"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || thinking}
                  aria-label="Send"
                  className="press shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-ink text-parchment disabled:opacity-40"
                >
                  <PaperPlaneRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </BodyPortal>
  )
}

function ChatBubble({ message, onPosted }: { message: Message; onPosted: () => void }) {
  const mine = message.role === 'user'
  return (
    <div className={cn('flex flex-col gap-1.5', mine ? 'items-end' : 'items-start')}>
      <p
        className={cn(
          'max-w-[90%] whitespace-pre-wrap rounded-(--radius-card) px-3 py-2 text-[13px] leading-relaxed',
          mine ? 'bg-ink text-parchment' : 'bg-sumi text-ink',
        )}
      >
        {message.body}
      </p>
      {!!message.cites?.length && (
        <div className="flex flex-wrap gap-1.5 max-w-[90%]">
          {message.cites.map(c => (
            <Link
              key={c.id}
              href={c.type === 'topic' ? `/board/${c.id}` : `/bytes/${c.id}`}
              className="truncate max-w-full rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-soft hover:border-border-strong"
            >
              {c.type === 'byte' ? 'Bytes: ' : ''}{c.title}
            </Link>
          ))}
        </div>
      )}
      {message.draft && <DraftCard draft={message.draft} posted={!!message.posted} onPosted={onPosted} />}
    </div>
  )
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
    <div className="w-[90%] rounded-(--radius-card) border border-border bg-paper p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-cha">Draft · {kind.label}</p>
      <p className="mt-1 text-[14px] font-semibold leading-snug text-ink">{draft.title}</p>
      <p className="mt-1 text-[12px] text-ink-soft"><span className="text-cha">{kind.second.label} </span>{draft.second}</p>
      {draft.context && <p className="mt-1 text-[12px] text-ink-soft"><span className="text-cha">Context </span>{draft.context}</p>}
      {draft.poll && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-cha">
          <ChartBar className="w-3.5 h-3.5" /> Poll: {draft.poll.question} ({draft.poll.options.join(' / ')})
        </p>
      )}

      {posted || topicId ? (
        <p className="mt-2.5 text-[12px] text-matcha">
          Posted.{topicId && <> <Link href={`/board/${topicId}`} className="underline">Open it</Link></>}
        </p>
      ) : (
        <div className="mt-2.5 flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft cursor-pointer select-none">
            <input type="checkbox" checked={ghost} onChange={e => setGhost(e.target.checked)} className="accent-ink" />
            Post anonymously
          </label>
          <Button size="sm" className="ml-auto" onClick={post} disabled={pending}>
            {pending ? 'Posting…' : 'Post'}
          </Button>
        </div>
      )}
    </div>
  )
}
