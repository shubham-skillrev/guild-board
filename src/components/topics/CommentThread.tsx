'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { FiEdit2, FiTrash2 } from 'react-icons/fi'
import { IoReturnUpForward } from 'react-icons/io5'
import type { Comment } from '@/types'

interface CommentThreadProps {
  topicId: string
  currentUserId: string | undefined
  isOpen: boolean
  onClose: () => void
  inline?: boolean
}

export function CommentThread({ topicId, currentUserId, isOpen, onClose, inline }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
    setSubmitting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, parent_id: replyTo?.id ?? null, body: newComment.trim() }),
      })
      if (res.ok) { setNewComment(''); setReplyTo(null); await fetchComments() }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    const res = await fetch('/api/comments', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commentId }),
    })
    if (res.ok) await fetchComments()
  }

  const handleEdit = async (commentId: string, body: string) => {
    const res = await fetch('/api/comments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commentId, body }),
    })
    if (res.ok) await fetchComments()
  }

  if (!isOpen) return null

  const commentsList = (
    <div className="space-y-1">
      {loading ? (
        <p className="text-cha text-sm text-center py-4">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="text-cha text-sm text-center py-6">No comments yet. Start the discussion!</p>
      ) : (
        comments.map(comment => (
          <CommentNode
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            depth={0}
            onReply={(id, username) => setReplyTo({ id, username })}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ))
      )}
    </div>
  )

  const composeArea = (
    <div className="space-y-2">
      {replyTo && (
        <div className="flex items-center gap-2 text-[12px] text-cha">
          <IoReturnUpForward className="w-3.5 h-3.5" />
          <span>Replying to <span className="text-ink-soft">@{replyTo.username}</span></span>
          <button onClick={() => setReplyTo(null)} className="text-red-400 hover:text-red-300 ml-1">&times;</button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          placeholder="Write a comment..."
          className="flex-1 bg-kinu/30 border border-border rounded-lg px-3 py-2.5 text-[13px] text-ink placeholder:text-cha focus:outline-none focus:border-saffron/40 transition-colors"
          maxLength={2000}
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
          className={cn(
            'px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all',
            newComment.trim() && !submitting
              ? 'bg-saffron text-parchment hover:bg-saffron/90'
              : 'bg-kinu/30 text-cha cursor-not-allowed'
          )}
        >
          {submitting ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )

  // Inline mode — no modal, just render directly
  if (inline) {
    return (
      <div>
        {composeArea}
        <div className="mt-5">{commentsList}</div>
      </div>
    )
  }

  // Modal mode
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-parchment/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[75vh] flex flex-col bg-paper border border-border rounded-xl shadow-2xl animate-fade-up">
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
}

function CommentNode({ comment, currentUserId, depth, onReply, onDelete, onEdit }: CommentNodeProps) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const isOwner = currentUserId === comment.user_id
  const maxDepth = 3

  const handleSaveEdit = () => {
    if (editBody.trim() && editBody.trim() !== comment.body) {
      onEdit(comment.id, editBody.trim())
    }
    setEditing(false)
  }

  const timeAgo = getTimeAgo(comment.created_at)

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
          <div className="mt-1.5 flex gap-2">
            <input
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(false) }}
              className="flex-1 bg-kinu/30 border border-border rounded-md px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:border-saffron/40"
              autoFocus
            />
            <button onClick={handleSaveEdit} className="text-[11px] text-saffron hover:text-saffron/80 font-medium">Save</button>
            <button onClick={() => setEditing(false)} className="text-[11px] text-cha hover:text-ink-soft">Cancel</button>
          </div>
        ) : (
          <p className="mt-1 text-[13px] text-ink leading-relaxed">{comment.body}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1.5 opacity-100 md:opacity-0 md:group-hover/comment:opacity-100 transition-opacity">
          {depth < maxDepth && (
            <button
              onClick={() => onReply(comment.id, comment.author_username ?? 'user')}
              className="inline-flex items-center gap-1 text-[11px] text-cha hover:text-ink-soft transition-colors"
            >
              <IoReturnUpForward className="w-3 h-3" />
              Reply
            </button>
          )}
          {isOwner && !editing && (
            <>
              <button
                onClick={() => { setEditBody(comment.body); setEditing(true) }}
                className="inline-flex items-center gap-1 text-[11px] text-cha hover:text-ink-soft transition-colors"
              >
                <FiEdit2 className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={() => onDelete(comment.id)}
                className="inline-flex items-center gap-1 text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
              >
                <FiTrash2 className="w-3 h-3" />
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
