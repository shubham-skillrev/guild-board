'use client'

import { ArrowFatUp, ArrowLeft, PencilSimple, Trash } from '@phosphor-icons/react/dist/ssr'
import { use, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Markdown } from '@/components/ui/Markdown'
import { cn } from '@/lib/utils/cn'
import { CATEGORY_LABELS, CATEGORY_TONE, DESCRIPTION_MAX_LENGTH } from '@/lib/constants'
import { kindOf, reactionFor } from '@/lib/kinds'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CommentThread } from '@/components/topics/CommentThread'
import { AuthorMark } from '@/components/topics/AuthorMark'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { useToast } from '@/hooks/useToast'
import { useGuestGate } from '@/components/auth/GuestGate'
import { SparkButton } from '@/components/voting/SparkButton'
import { SignalRow } from '@/components/topics/SignalRow'
import { PollCard } from '@/components/topics/PollCard'
import { PollEditor, pollPayload, type PollDraft } from '@/components/topics/PollEditor'
import { FOCUS_FORMAT } from '@/lib/experiment'
import { useLiveChannel } from '@/hooks/useLiveChannel'
import { topicChannel, type LiveUpdate } from '@/lib/realtime/channels'
import type { Topic, Comment, TopicPoll } from '@/types'

interface TopicDetail extends Topic {
  user_has_voted: boolean
}


export default function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const { cycle, phase } = useCurrentCycle()
  const toast = useToast()
  const { blockGuest } = useGuestGate()

  const [topic, setTopic] = useState<TopicDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPoll, setEditPoll] = useState<PollDraft | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Vote state
  const [votePending, setVotePending] = useState(false)
  const [votePop, setVotePop] = useState(false)

  // Spark window state
  const [sparkWindow, setSparkWindow] = useState<{
    cycleId: string
    sparkedUserId: string | null
  } | null>(null)

  const fetchTopic = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${id}`)
      if (!res.ok) {
        setError('Post not found')
        return
      }
      const data = await res.json()
      setTopic(data)
      setEditTitle(data.title)
      setEditDesc(data.description)
    } catch {
      setError('Failed to load topic')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchTopic() }, [fetchTopic])

  /* Live updates on topic:{id}. Counts are patched in place; the thread is
     told to refetch; a poll or edit change refetches the topic, since poll
     results and ownership are per-viewer. Never while you are editing: the
     refetch would overwrite your draft. */
  const [liveSignals, setLiveSignals] = useState<Record<string, number> | undefined>(undefined)
  const [commentsVersion, setCommentsVersion] = useState(0)
  // "GuildBot is typing": shown until its comment lands, or 25s at most.
  const [botTyping, setBotTyping] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current) }, [])
  const editingRef = useRef(false)
  useEffect(() => { editingRef.current = editing }, [editing])
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (refetchTimer.current) clearTimeout(refetchTimer.current) }, [])

  const onLive = useCallback((u: LiveUpdate) => {
    const c = u.counts
    if (c) {
      setTopic(t => t ? {
        ...t,
        vote_count: c.vote_count,
        comment_count: c.comment_count,
        score: c.score,
        poll: t.poll && c.poll_total !== null ? { ...t.poll, total_votes: c.poll_total } : t.poll,
      } : t)
      setLiveSignals(c.signal_counts)
    }
    if (u.changed.includes('bot_typing')) {
      setBotTyping(true)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setBotTyping(false), 25_000)
    }
    if (u.changed.includes('comments')) {
      setCommentsVersion(v => v + 1)
      setBotTyping(false)
    }
    if ((u.changed.includes('poll') || u.changed.includes('topics')) && !editingRef.current) {
      if (refetchTimer.current) clearTimeout(refetchTimer.current)
      refetchTimer.current = setTimeout(fetchTopic, 300)
    }
  }, [fetchTopic])

  const { present } = useLiveChannel(topicChannel(id), onLive, { presence: true })

  // Check spark window status
  useEffect(() => {
    if (phase !== 'discussion' || !cycle) return
    async function checkSparkWindow() {
      try {
        const res = await fetch(`/api/sparks?cycle_id=${cycle!.id}`)
        if (res.ok) {
          const data = await res.json()
          setSparkWindow({
            cycleId: cycle!.id,
            sparkedUserId: data.sparked_user_id ?? null,
          })
        }
      } catch { /* ignore */ }
    }
    checkSparkWindow()
  }, [phase, cycle])

  // Server-computed: user_id is absent on ghost topics (see lib/utils/anonymity).
  const isOwner = topic?.is_owner ?? user?.id === topic?.user_id
  const canVote = phase === 'open' && !isOwner

  const handleVote = async () => {
    if (!topic || !canVote || votePending) return
    if (blockGuest()) return
    const wasVoted = topic.user_has_voted
    // Optimistic update
    setTopic(t => t ? {
      ...t,
      user_has_voted: !wasVoted,
      vote_count: t.vote_count + (wasVoted ? -1 : 1),
    } : t)
    setVotePop(true)
    setTimeout(() => setVotePop(false), 400)
    setVotePending(true)
    try {
      const res = await fetch('/api/votes', {
        method: wasVoted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          wasVoted
            ? { topic_id: topic.id }
            : { topic_id: topic.id, cycle_id: topic.cycle_id }
        ),
      })
      if (res.ok) {
        if (!wasVoted) {
          toast(FOCUS_FORMAT ? `Marked: ${reactionFor(topic.category).idle.toLowerCase()}` : 'Vote committed to the ledger ⚡', 'success')
        } else {
          toast(FOCUS_FORMAT ? 'Unmarked' : 'Vote withdrawn', 'info')
        }
        fetchTopic() // background sync, no await
      } else {
        // Revert optimistic update
        setTopic(t => t ? {
          ...t,
          user_has_voted: wasVoted,
          vote_count: t.vote_count + (wasVoted ? 1 : -1),
        } : t)
        const data = await res.json().catch(() => ({}))
        if (res.status === 409) {
          toast(data.error ?? 'Vote limit reached for this cycle', 'warning', '🚫')
        } else {
          toast('Vote failed - check your connection', 'error')
        }
      }
    } catch {
      // Revert optimistic update
      setTopic(t => t ? {
        ...t,
        user_has_voted: wasVoted,
        vote_count: t.vote_count + (wasVoted ? 1 : -1),
      } : t)
      toast('Vote failed - check your connection', 'error')
    } finally {
      setVotePending(false)
    }
  }

  // A poll can be changed only until someone votes in it.
  const pollLocked = (topic?.poll?.total_votes ?? 0) > 0
  const draftFrom = (poll: TopicPoll | null | undefined): PollDraft | null =>
    poll ? { question: poll.question, options: poll.options.map(o => o.label) } : null

  const startEdit = () => {
    if (!topic) return
    setEditPoll(draftFrom(topic.poll))
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!topic || saving) return
    // Send the poll only when it changed, so an untouched poll is never rebuilt.
    const pollChanged = !pollLocked && JSON.stringify(editPoll) !== JSON.stringify(draftFrom(topic.poll))
    setSaving(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: topic.id,
          title: editTitle.trim(),
          description: editDesc.trim(),
          ...(pollChanged ? { poll: editPoll ? pollPayload(editPoll) : null } : {}),
        }),
      })
      if (res.ok) {
        setEditing(false)
        await fetchTopic()
        toast('Post updated', 'success')
      } else {
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? 'Edit failed. Try again.', 'error')
      }
    } catch {
      toast('Edit failed. Check your connection.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!topic) return
    setDeletePending(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: topic.id }),
      })
      if (res.ok) {
        router.push('/board')
        return
      }
      const data = await res.json().catch(() => ({}))
      setDeleteError(data.error ?? 'Delete failed. Please try again.')
    } catch {
      setDeleteError('Delete failed. Please check your connection and try again.')
    } finally {
      setDeletePending(false)
    }
  }

  if (loading) {
    return (
      <div className="px-5 md:px-10 py-12 w-full max-w-6xl mx-auto">
        <div className="text-center text-cha text-sm animate-pulse-soft py-20">Loading topic...</div>
      </div>
    )
  }

  if (error || !topic) {
    return (
      <div className="px-5 md:px-10 py-24 w-full max-w-6xl mx-auto text-center">
        <p className="text-ink-soft text-base mb-4">{error || 'Post not found'}</p>
        <Link href="/board" className="text-saffron text-sm hover:underline">← Back to board</Link>
      </div>
    )
  }

  const categoryTone = CATEGORY_TONE[topic.category] ?? 'saffron'

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-6xl mx-auto">
      {/* Back link */}
      <Link href="/board" className="inline-flex items-center gap-1.5 text-[13px] text-cha hover:text-ink-soft transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to board
      </Link>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* ─── Main content ─── */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {(!FOCUS_FORMAT || kindOf(topic.category)) && <Badge tone={categoryTone}>{CATEGORY_LABELS[topic.category]}</Badge>}
            {topic.status === 'carry_forward' && <Badge tone="indigo">Returning</Badge>}
            {topic.is_selected && <Badge tone="saffron">On the agenda</Badge>}
          </div>

          {/* Title + Edit/Delete */}
          {editing ? (
            <div className="space-y-3 mb-6">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                maxLength={80}
                className="w-full bg-kinu/30 border border-border rounded-(--radius-control) px-4 py-2.5 text-xl font-bold text-ink focus:outline-none focus:border-saffron/40 transition-colors"
                autoFocus
              />
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                maxLength={DESCRIPTION_MAX_LENGTH}
                rows={10}
                className="w-full bg-kinu/30 border border-border rounded-(--radius-control) px-4 py-3 text-[14px] text-ink font-mono focus:outline-none focus:border-saffron/40 resize-y transition-colors"
                placeholder="Supports **markdown** formatting"
              />
              <p className="text-[11px] text-cha text-right tabular-nums">{editDesc.length}/{DESCRIPTION_MAX_LENGTH}</p>
              {pollLocked ? (
                <p className="text-[12px] text-cha">The poll is locked because people have voted in it.</p>
              ) : (
                <PollEditor
                  value={editPoll}
                  onChange={setEditPoll}
                  fieldClassName="w-full px-3.5 bg-kinu/30 border border-border rounded-(--radius-control) text-ink placeholder:text-cha focus:outline-none focus:border-saffron/40 transition-colors"
                />
              )}
              <div className="flex items-center gap-2">
                <Button onClick={handleSaveEdit} disabled={saving || !editTitle.trim() || !editDesc.trim() || (!!editPoll && !pollLocked && !pollPayload(editPoll))}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setEditing(false); setEditTitle(topic.title); setEditDesc(topic.description) }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                <h1 className="font-serif text-[2.25rem] md:text-[2.625rem] font-normal tracking-[-0.012em] text-ink leading-[1.1] text-balance">{topic.title}</h1>
                {isOwner && phase === 'open' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" icon={PencilSimple} onClick={startEdit} title="Edit post">
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button size="sm" variant="danger" icon={Trash} onClick={() => setConfirmDelete(true)} title="Delete post">
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Delete confirmation */}
              {confirmDelete && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4 px-(--pad-card) py-3 bg-vermillion/10 rounded-(--radius-card) text-footnote">
                  <span className="text-vermillion sm:mr-2">Permanently delete this post?</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      className="bg-vermillion hover:bg-vermillion/90"
                      onClick={handleDelete}
                      disabled={deletePending}
                    >
                      {deletePending ? 'Deleting…' : 'Yes, delete'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {deleteError && (
                <div className="mb-4 px-(--pad-card) py-3 bg-vermillion/10 rounded-(--radius-card) text-[12px] text-vermillion">
                  {deleteError}
                </div>
              )}

              {/* Author line */}
              <div className="flex items-center gap-2 mb-5">
                <AuthorMark username={topic.author_username} isSystem={topic.is_system} size={24} className="text-[13px]" />
                <span className="text-[11px] text-cha">· {new Date(topic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {/* Spark button - visible during discussion phase */}
                {/* Ghost authors are not sparkable - can_spark_author is false and
                    user_id is absent, so there is nobody to award it to. */}
                {sparkWindow && topic.can_spark_author && topic.user_id && (
                  <span className="ml-auto">
                    <SparkButton
                      toUserId={topic.user_id}
                      cycleId={sparkWindow.cycleId}
                      alreadyGiven={sparkWindow.sparkedUserId === topic.user_id}
                      isDisabled={sparkWindow.sparkedUserId !== null && sparkWindow.sparkedUserId !== topic.user_id}
                      onSpark={() => setSparkWindow(prev => prev && topic.user_id ? { ...prev, sparkedUserId: topic.user_id } : prev)}
                    />
                  </span>
                )}
              </div>

              {/* Description - rendered as markdown */}
              <div className="prose-guild mb-5">
                <Markdown>{topic.description}</Markdown>
              </div>

              {topic.poll && (
                <div className="mb-6">
                  <PollCard poll={topic.poll} onChange={poll => setTopic(t => (t ? { ...t, poll } : t))} />
                </div>
              )}

              {/* One-tap responses - usable even when the board is locked. */}
              <div className="mb-8">
                <SignalRow topicId={topic.id} liveCounts={liveSignals} />
              </div>
            </>
          )}

          {/* Vote bar. On your own post the counts show as plain
              text rather than disabled buttons: you cannot back it, and a
              greyed control reads as broken. */}
          {isOwner ? (
            <div className="flex flex-wrap items-center gap-5 mb-8 pb-6 border-b border-border text-footnote text-ink-soft">
              <span className="inline-flex items-center gap-2">
                <ArrowFatUp className="w-4 h-4" />
                <span className="font-bold tabular-nums text-ink">{topic.vote_count}</span>
                <span className="text-[12px]">{topic.vote_count === 1 ? 'upvote' : 'upvotes'}</span>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 mb-8 pb-6 border-b border-border">
              <button
                onClick={handleVote}
                disabled={!canVote || votePending}
                className={cn(
                  'inline-flex items-center gap-2 h-9 px-3 rounded-(--radius-control) border text-footnote font-medium transition-colors',
                  topic.user_has_voted
                    ? 'bg-saffron/12 border-saffron/35 text-saffron'
                    : canVote
                      ? 'border-border text-ink-soft hover:border-saffron/30 hover:text-saffron'
                      : 'border-border text-ink-muted opacity-50',
                  votePending ? 'opacity-60 cursor-wait' : canVote ? 'cursor-pointer' : 'cursor-not-allowed',
                )}
              >
                {votePending ? (
                  <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin-fast" />
                ) : (
                  <span className={cn('transition-transform', votePop && 'animate-vote-pop')}>
                    {topic.user_has_voted ? <ArrowFatUp className="w-4 h-4" /> : <ArrowFatUp className="w-4 h-4" />}
                  </span>
                )}
                <span className="font-bold tabular-nums">{topic.vote_count}</span>
                <span className="text-[12px]">{FOCUS_FORMAT
                    ? topic.user_has_voted ? reactionFor(topic.category).done : reactionFor(topic.category).idle
                    : topic.user_has_voted ? 'Upvoted' : 'Upvote'}</span>
              </button>
            </div>
          )}

          {/* Comments / Discussion section */}
          <div>
            <h2 className="flex items-baseline gap-2 mb-4 text-[17px] font-semibold tracking-[-0.01em] text-ink">
              Discussion
              {topic.comment_count > 0 && (
                <span className="text-[13px] font-normal text-cha tabular-nums">{topic.comment_count}</span>
              )}
              {/* Anonymous count of open tabs: never who, only how many. */}
              {present > 1 && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-normal text-cha">
                  <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-matcha" />
                  {present} here now
                </span>
              )}
            </h2>
            <CommentThread
              topicId={topic.id}
              currentUserId={user?.id}
              isOpen={true}
              onClose={() => {}}
              inline
              isGhostOp={topic.is_anonymous && topic.is_owner === true}
              refreshKey={commentsVersion}
            />
            {botTyping && (
              <p role="status" className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-cha">
                <span aria-hidden className="text-saffron">◈</span>
                GuildBot is typing<span className="animate-pulse">…</span>
              </p>
            )}
          </div>
        </div>

        {/* ─── Right sidebar: stats and spark ─── */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-20">
            {/* Topic stats */}
            <div className="bg-paper/50 border border-border rounded-(--radius-card) p-(--pad-card) space-y-2.5">
              <h3 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-2">Stats</h3>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-cha">{FOCUS_FORMAT ? (kindOf(topic.category)?.value === 'problem' ? 'Hit this too' : 'Want to discuss') : 'Votes'}</span>
                <span className="text-ink font-medium tabular-nums">{topic.vote_count}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-cha">Comments</span>
                <span className="text-ink font-medium tabular-nums">{topic.comment_count}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-cha">Score</span>
                <span className="text-saffron font-medium tabular-nums">{topic.score.toFixed(1)}</span>
              </div>
            </div>

            {/* Spark budget indicator */}
            {sparkWindow && (
              <div className="mt-4 bg-paper/50 border border-saffron/20 rounded-(--radius-card) p-(--pad-card)">
                <h3 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-2">Spark</h3>
                {sparkWindow.sparkedUserId ? (
                  <p className="text-[12px] text-saffron font-medium">
                    ⚡ You&apos;ve used your spark this cycle
                  </p>
                ) : (
                  <p className="text-[12px] text-ink-soft">
                    ⚡ <span className="text-saffron font-medium">1 spark</span> available - give it to a builder who inspired you
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
