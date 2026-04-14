'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils/cn'
import { CATEGORY_LABELS, DESCRIPTION_MAX_LENGTH } from '@/lib/constants'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { CommentThread } from '@/components/topics/CommentThread'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { BiUpvote, BiSolidUpvote } from 'react-icons/bi'
import { FaHandshake } from 'react-icons/fa6'
import { IoArrowBack } from 'react-icons/io5'
import { FiEdit2, FiTrash2 } from 'react-icons/fi'
import { SparkButton } from '@/components/voting/SparkButton'
import type { Topic, Comment } from '@/types'

interface TopicDetail extends Topic {
  user_has_voted: boolean
  user_has_contribed: boolean
  contributors: { user_id: string; username: string }[]
}

const CATEGORY_STYLES: Record<string, { dot: string; badge: string }> = {
  deep_dive: { dot: 'bg-indigo-jp', badge: 'text-indigo-jp bg-indigo-light' },
  discussion: { dot: 'bg-saffron', badge: 'text-saffron bg-saffron-light' },
  blog_idea: { dot: 'bg-matcha', badge: 'text-matcha bg-matcha-light' },
  project_showcase: { dot: 'bg-wisteria', badge: 'text-wisteria bg-wisteria-light' },
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

  const [topic, setTopic] = useState<TopicDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Vote/contrib state
  const [votePending, setVotePending] = useState(false)
  const [contribPending, setContribPending] = useState(false)

  // Spark window state
  const [sparkWindow, setSparkWindow] = useState<{
    cycleId: string
    sparkedUserId: string | null
  } | null>(null)

  const fetchTopic = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${id}`)
      if (!res.ok) {
        setError('Topic not found')
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

  const isOwner = user?.id === topic?.user_id
  const canVote = phase === 'open' && !isOwner
  const canContrib = phase === 'open' && !isOwner

  const handleVote = async () => {
    if (!topic || !canVote || votePending) return
    setVotePending(true)
    try {
      const res = await fetch('/api/votes', {
        method: topic.user_has_voted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          topic.user_has_voted
            ? { topic_id: topic.id }
            : { topic_id: topic.id, cycle_id: topic.cycle_id }
        ),
      })
      if (res.ok) await fetchTopic()
    } finally {
      setVotePending(false)
    }
  }

  const handleContrib = async () => {
    if (!topic || !canContrib || contribPending) return
    setContribPending(true)
    try {
      const res = await fetch('/api/contributions', {
        method: topic.user_has_contribed ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          topic.user_has_contribed
            ? { topic_id: topic.id }
            : { topic_id: topic.id, cycle_id: topic.cycle_id }
        ),
      })
      if (res.ok) await fetchTopic()
    } finally {
      setContribPending(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!topic || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: topic.id, title: editTitle.trim(), description: editDesc.trim() }),
      })
      if (res.ok) {
        setEditing(false)
        await fetchTopic()
      }
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
        <p className="text-ink-soft text-base mb-4">{error || 'Topic not found'}</p>
        <Link href="/board" className="text-saffron text-sm hover:underline">← Back to board</Link>
      </div>
    )
  }

  const style = CATEGORY_STYLES[topic.category] ?? CATEGORY_STYLES.discussion

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-6xl mx-auto">
      {/* Back link */}
      <Link href="/board" className="inline-flex items-center gap-1.5 text-[13px] text-cha hover:text-ink-soft transition-colors mb-6">
        <IoArrowBack className="w-4 h-4" />
        Back to board
      </Link>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* ─── Main content ─── */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full', style.badge)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
              {CATEGORY_LABELS[topic.category]}
            </span>
            {topic.status === 'carry_forward' && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-indigo-light text-indigo-jp">↩ Returning</span>
            )}
            {topic.is_selected && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-saffron-light text-saffron">★ Selected</span>
            )}
          </div>

          {/* Title + Edit/Delete */}
          {editing ? (
            <div className="space-y-3 mb-6">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                maxLength={80}
                className="w-full bg-kinu/30 border border-border rounded-lg px-4 py-2.5 text-xl font-bold text-ink focus:outline-none focus:border-saffron/40 transition-colors"
                autoFocus
              />
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                maxLength={DESCRIPTION_MAX_LENGTH}
                rows={10}
                className="w-full bg-kinu/30 border border-border rounded-lg px-4 py-3 text-[14px] text-ink font-mono focus:outline-none focus:border-saffron/40 resize-y transition-colors"
                placeholder="Supports **markdown** formatting"
              />
              <p className="text-[11px] text-cha text-right tabular-nums">{editDesc.length}/{DESCRIPTION_MAX_LENGTH}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editTitle.trim() || !editDesc.trim()}
                  className="px-4 py-2 bg-saffron text-parchment text-[13px] font-semibold rounded-lg hover:bg-saffron/90 disabled:opacity-40 transition-all"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditTitle(topic.title); setEditDesc(topic.description) }}
                  className="px-4 py-2 text-cha text-[13px] hover:text-ink-soft transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                <h1 className="font-serif text-2xl font-bold text-ink leading-snug">{topic.title}</h1>
                {isOwner && phase === 'open' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1 p-2 text-cha hover:text-ink-soft hover:bg-kinu/40 rounded-lg transition-colors"
                      title="Edit topic"
                    >
                      <FiEdit2 className="w-4 h-4" />
                      <span className="text-[12px] hidden sm:inline">Edit</span>
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex items-center gap-1 p-2 text-cha hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Delete topic"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      <span className="text-[12px] hidden sm:inline">Delete</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Delete confirmation */}
              {confirmDelete && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-lg text-[13px]">
                  <span className="text-red-400">Permanently delete this topic?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deletePending}
                    className="px-3 py-1 bg-red-400 text-parchment rounded-md text-[12px] font-medium hover:bg-red-500 transition-colors disabled:opacity-60"
                  >
                    {deletePending ? 'Deleting...' : 'Yes, delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-cha hover:text-ink-soft text-[12px]">
                    Cancel
                  </button>
                </div>
              )}
              {deleteError && (
                <div className="mb-4 px-4 py-3 bg-vermillion-light border border-vermillion/20 rounded-lg text-[12px] text-vermillion">
                  {deleteError}
                </div>
              )}

              {/* Author line */}
              <div className="flex items-center gap-2 mb-5">
                <UserAvatar username={topic.author_username ?? 'user'} size={24} />
                <span className="text-[13px] text-ink-soft">@{topic.author_username}</span>
                <span className="text-[11px] text-cha">· {new Date(topic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {/* Spark button — visible during discussion phase */}
                {sparkWindow && topic.user_id !== user?.id && (
                  <span className="ml-auto">
                    <SparkButton
                      toUserId={topic.user_id}
                      cycleId={sparkWindow.cycleId}
                      alreadyGiven={sparkWindow.sparkedUserId === topic.user_id}
                      isDisabled={sparkWindow.sparkedUserId !== null && sparkWindow.sparkedUserId !== topic.user_id}
                      onSpark={() => setSparkWindow(prev => prev ? { ...prev, sparkedUserId: topic.user_id } : prev)}
                    />
                  </span>
                )}
              </div>

              {/* Description — rendered as markdown */}
              <div className="prose-guild mb-8">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {topic.description}
                </ReactMarkdown>
              </div>
            </>
          )}

          {/* Vote + Contrib bar */}
          <div className="flex flex-wrap items-center gap-3 mb-8 pb-6 border-b border-border">
            <button
              onClick={handleVote}
              disabled={!canVote || votePending}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[13px] font-medium transition-all',
                topic.user_has_voted
                  ? 'bg-saffron/15 border-saffron/40 text-saffron shadow-[0_0_12px_rgba(232,145,58,0.15)]'
                  : canVote
                    ? 'bg-paper border-border text-ink-soft hover:border-saffron/30 hover:text-saffron hover:bg-saffron/5'
                    : 'bg-paper/50 border-border text-cha opacity-50',
              )}
            >
              {topic.user_has_voted ? <BiSolidUpvote className="w-4 h-4" /> : <BiUpvote className="w-4 h-4" />}
              <span className="font-bold tabular-nums">{topic.vote_count}</span>
              <span className="text-[12px]">{topic.user_has_voted ? 'Upvoted' : 'Upvote'}</span>
            </button>
            <button
              onClick={handleContrib}
              disabled={!canContrib || contribPending}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[13px] font-medium transition-all',
                topic.user_has_contribed
                  ? 'bg-matcha/15 border-matcha/40 text-matcha shadow-[0_0_10px_rgba(61,184,138,0.12)]'
                  : canContrib
                    ? 'bg-paper border-border text-ink-soft hover:border-matcha/30 hover:text-matcha hover:bg-matcha/5'
                    : 'bg-paper/50 border-border text-cha opacity-50',
              )}
            >
              <FaHandshake className="w-4 h-4" />
              <span className="font-bold tabular-nums">{topic.contrib_count}</span>
              <span className="text-[12px]">{topic.user_has_contribed ? "I'm in" : 'Join discussion'}</span>
            </button>
          </div>

          {/* Comments / Discussion section */}
          <div>
            <h2 className="text-sm font-semibold text-ink mb-4">Discussion</h2>
            <CommentThread
              topicId={topic.id}
              currentUserId={user?.id}
              isOpen={true}
              onClose={() => {}}
              inline
            />
          </div>
        </div>

        {/* ─── Right sidebar: Contributors ─── */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-20">
            <div className="bg-paper/50 border border-border rounded-xl p-4">
              <h3 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-3">
                Contributors ({topic.contributors.length})
              </h3>
              {topic.contributors.length === 0 ? (
                <p className="text-[12px] text-cha">No contributors yet</p>
              ) : (
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
                  {topic.contributors.map((c) => (
                    <div key={c.user_id} className="flex items-center gap-2">
                      <UserAvatar username={c.username} size={24} />
                      <span className="text-[13px] text-ink-soft truncate">@{c.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Topic stats */}
            <div className="mt-4 bg-paper/50 border border-border rounded-xl p-4 space-y-2.5">
              <h3 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-2">Stats</h3>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-cha">Votes</span>
                <span className="text-ink font-medium tabular-nums">{topic.vote_count}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-cha">Contributors</span>
                <span className="text-ink font-medium tabular-nums">{topic.contrib_count}</span>
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
              <div className="mt-4 bg-paper/50 border border-saffron/20 rounded-xl p-4">
                <h3 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-2">Spark</h3>
                {sparkWindow.sparkedUserId ? (
                  <p className="text-[12px] text-saffron font-medium">
                    ⚡ You&apos;ve used your spark this cycle
                  </p>
                ) : (
                  <p className="text-[12px] text-ink-soft">
                    ⚡ <span className="text-saffron font-medium">1 spark</span> available — give it to a builder who inspired you
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
