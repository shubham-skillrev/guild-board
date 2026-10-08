'use client'

import { ArrowBendUpRight, PencilSimple, ThumbsUp, Trash } from '@phosphor-icons/react/dist/ssr'
import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { useGuestGate } from '@/components/auth/GuestGate'
import { Markdown } from '@/components/ui/Markdown'
import type { Comment } from '@/types'

interface CommentThreadProps {
  topicId: string
  currentUserId: string | undefined
  isOpen: boolean
  onClose: () => void
  inline?: boolean
}

interface Member { id: string; username: string }
interface Ask { asked_id: string; username: string; can_withdraw: boolean }

/** An @ being typed right before the caret: where it starts and what follows it. */
function detectMention(text: string, caret: number): { start: number; query: string } | null {
  const m = text.slice(0, caret).match(/(?:^|\s)@([\w.-]{0,30})$/)
  return m ? { start: caret - m[1].length - 1, query: m[1] } : null
}

/** The note an ask carries is capped server-side at 140 characters. */
const ASK_NOTE_MAX = 140

type SortKey = 'newest' | 'top' | 'replies'

function sortComments(list: Comment[], by: SortKey): Comment[] {
  const sorted = [...list].sort((a, b) => {
    if (by === 'top')     return (b.like_count ?? 0) - (a.like_count ?? 0)
    if (by === 'replies') return (b.replies?.length ?? 0) - (a.replies?.length ?? 0)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  return sorted.map(c => c.replies?.length ? { ...c, replies: sortComments(c.replies, by) } : c)
}

export function CommentThread({ topicId, currentUserId, isOpen, onClose, inline }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const toast = useToast()
  const { blockGuest } = useGuestGate()
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sort, setSort] = useState<SortKey>('newest')

  /* Mentions and asks, in the one composer. Typing @ lists every member.
     Mentioning someone who can still be asked also sends them a direct ask
     (2 per person per topic, enforced server-side), carrying the comment as
     the note: the old separate "Ask someone in" panel, folded into writing. */
  const [members, setMembers] = useState<Member[]>([])
  const [askable, setAskable] = useState<Set<string>>(new Set())
  const [asksLeft, setAsksLeft] = useState(0)
  const [asked, setAsked] = useState<Ask[]>([])
  const [asksVersion, setAsksVersion] = useState(0)
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    fetch(`/api/topic-asks?topic_id=${topicId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setMembers(data.members ?? [])
        setAskable(new Set((data.candidates ?? []).map((c: Member) => c.id)))
        setAsksLeft(data.remaining ?? 0)
        setAsked(data.asks ?? [])
      })
      .catch(() => { /* mentions are a nicety; the composer works without them */ })
    return () => { cancelled = true }
  }, [topicId, isOpen, asksVersion])

  const suggestions = mention
    ? members
        .filter(m => m.username.toLowerCase().includes(mention.query.toLowerCase()))
        .sort((a, b) => {
          const q = mention.query.toLowerCase()
          return Number(b.username.toLowerCase().startsWith(q)) - Number(a.username.toLowerCase().startsWith(q))
        })
    : []

  const mentionedNames = new Set(
    [...newComment.matchAll(/(?:^|\s)@([\w.-]+)/g)].map(m => m[1].toLowerCase()),
  )
  const willAsk = members
    .filter(m => mentionedNames.has(m.username.toLowerCase()) && askable.has(m.id))
    .slice(0, asksLeft)

  const insertMention = (member: Member) => {
    const el = textareaRef.current
    if (!el || !mention) return
    const caret = el.selectionStart
    const insert = `@${member.username} `
    const next = newComment.slice(0, mention.start) + insert + newComment.slice(caret)
    setNewComment(next)
    setMention(null)
    const pos = mention.start + insert.length
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos) })
  }

  /* The @ button: puts an @ at the caret (with a space before it if needed)
     and opens the member list, for anyone who does not know the shortcut. */
  const startMention = () => {
    const el = textareaRef.current
    if (!el) return
    const caret = el.selectionStart ?? newComment.length
    const before = newComment.slice(0, caret)
    const pad = before && !/\s$/.test(before) ? ' ' : ''
    const next = before + pad + '@' + newComment.slice(caret)
    setNewComment(next)
    const pos = caret + pad.length + 1
    setMention({ start: pos - 1, query: '' })
    setActiveIdx(0)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos) })
  }

  const withdrawAsk = async (ask: Ask) => {
    const res = await fetch('/api/topic-asks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: topicId, asked_id: ask.asked_id }),
    })
    if (!res.ok) { toast('Could not withdraw', 'error'); return }
    setAsksVersion(v => v + 1)
  }

  const fetchComments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/comments?topic_id=${topicId}`)
      if (res.ok) setComments(await res.json())
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    if (isOpen) fetchComments()
  }, [isOpen, fetchComments])

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return
    if (blockGuest()) return
    setSubmitting(true)
    const body = newComment.trim()
    const toAsk = willAsk
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, parent_id: replyTo?.id ?? null, body }),
      })
      if (res.ok) {
        setNewComment(''); setReplyTo(null); setMention(null)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        await fetchComments()
        if (toAsk.length) {
          const note = body.length > ASK_NOTE_MAX ? body.slice(0, ASK_NOTE_MAX - 1) + '…' : body
          const results = await Promise.all(toAsk.map(m =>
            fetch('/api/topic-asks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ topic_id: topicId, asked_id: m.id, note }),
            }).then(r => r.ok).catch(() => false),
          ))
          const done = toAsk.filter((_, i) => results[i])
          if (done.length) toast(`Asked ${done.map(m => `@${m.username}`).join(' and ')} to weigh in`, 'success')
          setAsksVersion(v => v + 1)
        }
      } else {
        // The text stays in the box so nothing is lost; say why it did not go.
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? 'Could not send. Try again.', 'error')
      }
    } catch {
      toast('Could not send, check your connection', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    const res = await fetch('/api/comments', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commentId }),
    })
    if (res.ok) {
      await fetchComments()
    } else {
      const data = await res.json().catch(() => ({}))
      toast(data.error ?? 'Failed to delete comment', 'error')
    }
  }

  const handleEdit = async (commentId: string, body: string) => {
    const res = await fetch('/api/comments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commentId, body }),
    })
    if (res.ok) await fetchComments()
  }

  const handleReactionChange = useCallback((
    commentId: string,
    reaction: 1 | -1 | null,
    likeDelta: number,
    dislikeDelta: number,
  ) => {
    const patch = (list: Comment[]): Comment[] =>
      list.map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            user_reaction: reaction,
            like_count: Math.max(0, (c.like_count ?? 0) + likeDelta),
            dislike_count: Math.max(0, (c.dislike_count ?? 0) + dislikeDelta),
          }
        }
        if (c.replies?.length) return { ...c, replies: patch(c.replies) }
        return c
      })
    setComments(prev => patch(prev))
  }, [])

  if (!isOpen) return null

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'newest',  label: 'Newest'  },
    { key: 'top',     label: 'Top'     },
    { key: 'replies', label: 'Replies' },
  ]

  const sorted = sortComments(comments, sort)

  const commentsList = (
    <div className="space-y-1">
      {/* Sort bar */}
      {!loading && comments.length > 1 && (
        <div className="flex items-center gap-1 mb-3">
          <span className="text-[11px] text-cha mr-1">Sort:</span>
          {SORT_OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => setSort(o.key)}
              className={cn(
                'press inline-flex items-center h-6.5 px-2 pointer-coarse:h-9 pointer-coarse:px-2.5 rounded-(--radius-control) text-[11px] font-medium transition-colors',
                sort === o.key
                  ? 'bg-fill text-ink'
                  : 'text-ink-muted hover:text-ink hover:bg-kinu/60',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-cha text-sm text-center py-4">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="text-[13px] text-cha py-4">No replies yet. Start it off.</p>
      ) : (
        sorted.map(comment => (
          <CommentNode
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            depth={0}
            onReply={(id, username) => setReplyTo({ id, username })}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onReactionChange={handleReactionChange}
          />
        ))
      )}
    </div>
  )

  const composeArea = (
    <div className="space-y-2">
      {replyTo && (
        <div className="flex items-center gap-2 text-[12px] text-cha">
          <ArrowBendUpRight className="w-3.5 h-3.5" />
          <span>Replying to <span className="text-ink-soft">@{replyTo.username}</span></span>
          <button onClick={() => setReplyTo(null)} className="text-ink-muted hover:text-ink ml-1">&times;</button>
        </div>
      )}
      {/* One box: the text, the member list when an @ is being typed, then a
          footer with the @ button, the hint and Send. */}
      <div className="rounded-(--radius-card) border border-border bg-paper focus-within:border-border-strong transition-colors">
        <textarea
          ref={textareaRef}
          value={newComment}
          rows={2}
          onChange={e => {
            setNewComment(e.target.value)
            setMention(detectMention(e.target.value, e.target.selectionStart))
            setActiveIdx(0)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 200) + 'px'
          }}
          onSelect={e => {
            const el = e.currentTarget
            setMention(detectMention(el.value, el.selectionStart))
          }}
          onBlur={() => setTimeout(() => setMention(null), 120)}
          onKeyDown={e => {
            if (mention && suggestions.length) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % suggestions.length); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + suggestions.length) % suggestions.length); return }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[activeIdx]); return }
              if (e.key === 'Escape') { e.preventDefault(); setMention(null); return }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
          }}
          placeholder={replyTo ? `Reply to @${replyTo.username}…` : 'Add to the discussion… type @ to bring someone in'}
          aria-label="Write a reply"
          aria-autocomplete="list"
          className="block w-full bg-transparent px-4 pt-3.5 pb-2 text-[14px] leading-relaxed text-ink placeholder:text-cha focus:outline-none resize-none overflow-y-auto"
          style={{ maxHeight: '200px' }}
          maxLength={2000}
        />

        {mention && suggestions.length > 0 && (
          <ul role="listbox" aria-label="Members" className="mx-2 mb-2 max-h-56 overflow-y-auto rounded-(--radius-control) border border-border bg-sumi py-1">
            {suggestions.map((m, i) => {
              const canAsk = askable.has(m.id) && asksLeft > 0
              return (
                <li key={m.id} role="option" aria-selected={i === activeIdx}>
                  <button
                    type="button"
                    // mousedown, not click: it fires before the textarea blurs.
                    onMouseDown={e => { e.preventDefault(); insertMention(m) }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors',
                      i === activeIdx ? 'bg-kinu text-ink' : 'text-ink-soft',
                    )}
                  >
                    <UserAvatar username={m.username} size={20} />
                    <span className="truncate">@{m.username}</span>
                    {canAsk && <span className="ml-auto text-[11px] text-cha">also asks them</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex items-center gap-2 px-2 pb-2.5 pl-2.5">
          <button
            type="button"
            onClick={startMention}
            aria-label="Mention someone"
            title="Mention someone"
            className="press inline-flex items-center justify-center w-8 h-8 rounded-full text-[15px] text-ink-soft hover:text-ink hover:bg-kinu/60 transition-colors"
          >
            @
          </button>
          <span className="min-w-0 truncate text-[12px] text-cha">
            {willAsk.length > 0
              ? <>Also asks {willAsk.map(m => <span key={m.id} className="text-ink-soft">@{m.username}</span>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ' and ', el] : [el]), [])} to weigh in</>
              : <>Markdown works · <kbd className="font-sans">Enter</kbd> to send</>}
          </span>
          <Button className="ml-auto" onClick={handleSubmit} disabled={!newComment.trim() || submitting}>
            {submitting ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>

      {asked.length > 0 && (
        <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px] text-cha">
          Asked:
          {asked.map(a => (
            <span key={a.asked_id} className="inline-flex items-center gap-1 pl-0.5 pr-2 h-6 rounded-full border border-border text-ink-soft">
              <UserAvatar username={a.username} size={18} />
              @{a.username}
              {a.can_withdraw && (
                <button type="button" onClick={() => withdrawAsk(a)} aria-label={`Withdraw ask to ${a.username}`} className="text-cha hover:text-vermillion">×</button>
              )}
            </span>
          ))}
        </p>
      )}
    </div>
  )

  // Inline mode - no modal, just render directly
  if (inline) {
    return (
      <div>
        {composeArea}
        <div className="mt-6">{commentsList}</div>
      </div>
    )
  }

  // Modal mode
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-parchment/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[75vh] flex flex-col bg-paper border border-border rounded-(--radius-card) shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-ink">Discussion</h3>
          <button onClick={onClose} className="text-cha hover:text-ink transition-colors text-lg leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{commentsList}</div>
        <div className="border-t border-border px-5 py-3">{composeArea}</div>
      </div>
    </div>
  )
}

/* ──── Single comment node (recursive for threads) ──── */

interface CommentNodeProps {
  comment: Comment
  currentUserId: string | undefined
  depth: number
  onReply: (id: string, username: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string, body: string) => void
  onReactionChange: (commentId: string, reaction: 1 | -1 | null, likeDelta: number, dislikeDelta: number) => void
}

function CommentNode({ comment, currentUserId, depth, onReply, onDelete, onEdit, onReactionChange }: CommentNodeProps) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [reactionPending, setReactionPending] = useState(false)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()
  const { blockGuest } = useGuestGate()
  const isOwner = currentUserId === comment.user_id
  const maxDepth = 3

  const handleSaveEdit = () => {
    if (editBody.trim() && editBody.trim() !== comment.body) {
      onEdit(comment.id, editBody.trim())
    }
    setEditing(false)
  }

  // Like is the only reaction now; -1 is rejected server-side.
  const handleReaction = async (value: 1) => {
    if (blockGuest()) return
    if (!currentUserId || reactionPending) return
    const prev = comment.user_reaction ?? null

    const isOn = prev === value
    const nextReaction: 1 | null = isOn ? null : value
    const likeDelta = isOn ? -1 : 1
    const dislikeDelta = 0

    // Optimistic
    onReactionChange(comment.id, nextReaction, likeDelta, dislikeDelta)
    setReactionPending(true)

    try {
      const res = await fetch('/api/comment-reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: comment.id, reaction: value }),
      })
      if (!res.ok) {
        // Revert
        onReactionChange(comment.id, prev, -likeDelta, -dislikeDelta)
        toast('Reaction failed', 'error')
      }
    } catch {
      onReactionChange(comment.id, prev, -likeDelta, -dislikeDelta)
      toast('Reaction failed - check your connection', 'error')
    } finally {
      setReactionPending(false)
    }
  }

  const timeAgo = getTimeAgo(comment.created_at)
  const likeCount = comment.like_count ?? 0

  return (
    <div className={cn('group/comment', depth > 0 && 'ml-5 pl-3 border-l border-border/50')}>
      <div className="py-2.5">
        {/* Author line */}
        <div className="flex items-center gap-2 text-[12px]">
          <UserAvatar username={comment.author_username ?? 'user'} size={20} />
          <span className="font-medium text-ink-soft">@{comment.author_username}</span>
          <span className="text-cha">{timeAgo}</span>
          {comment.updated_at !== comment.created_at && (
            <span className="text-cha text-[11px]">(edited)</span>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div className="mt-1.5 space-y-1.5">
            <textarea
              ref={editTextareaRef}
              value={editBody}
              rows={2}
              onChange={e => {
                setEditBody(e.target.value)
                const el = e.target
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 200) + 'px'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
                if (e.key === 'Escape') setEditing(false)
              }}
              className="w-full bg-kinu/30 border border-border rounded-(--radius-control) px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:border-saffron/40 resize-none overflow-y-auto"
              style={{ maxHeight: '200px' }}
              autoFocus
              onFocus={e => {
                const el = e.target
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 200) + 'px'
              }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="text-[11px] text-cha hover:text-ink-soft">Cancel</button>
              <button onClick={handleSaveEdit} className="text-[11px] text-saffron hover:text-saffron/80 font-medium">Save</button>
            </div>
          </div>
        ) : (
          <div className="prose-guild mt-1">
            <Markdown>{comment.body}</Markdown>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1.5">
          {/* Like only. The dislike button was removed deliberately: in a
              30-person company board, "2 dislikes" means two named colleagues
              publicly downvoted you, which is exactly the risk that keeps
              quiet members quiet. Existing rows are kept, just not shown. */}
          {currentUserId && (
            <button
              onClick={() => handleReaction(1)}
              disabled={reactionPending}
              className={cn(
                'inline-flex items-center gap-1 text-[11px] transition-colors cursor-pointer',
                comment.user_reaction === 1
                  ? 'text-matcha'
                  : 'text-cha hover:text-matcha',
                reactionPending && 'opacity-50 cursor-wait',
              )}
            >
              <ThumbsUp className={cn('w-3 h-3', comment.user_reaction === 1 && 'animate-vote-pop')} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
          )}

          {depth < maxDepth && (
            <button
              onClick={() => onReply(comment.id, comment.author_username ?? 'user')}
              className="inline-flex items-center gap-1 text-[11px] text-cha hover:text-ink-soft transition-colors cursor-pointer"
            >
              <ArrowBendUpRight className="w-3 h-3" />
              Reply
            </button>
          )}
          {isOwner && !editing && (
            <>
              <button
                onClick={() => { setEditBody(comment.body); setEditing(true) }}
                className="inline-flex items-center gap-1 text-[11px] text-cha hover:text-ink-soft transition-colors cursor-pointer"
              >
                <PencilSimple className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={() => onDelete(comment.id)}
                className="inline-flex items-center gap-1 text-[11px] text-red-400/70 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash className="w-3 h-3" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map(reply => (
            <CommentNode
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              depth={Math.min(depth + 1, maxDepth)}
              onReply={onReply}
              onDelete={onDelete}
              onEdit={onEdit}
              onReactionChange={onReactionChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}


function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}
