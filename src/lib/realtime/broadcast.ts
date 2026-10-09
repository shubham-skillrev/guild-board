import 'server-only'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LIVE_EVENT, boardChannel, topicChannel, type LiveChange, type LiveCounts, type LiveUpdate } from './channels'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Tell everyone watching that a topic changed. Runs after the response is
 * sent, re-reads the counts the triggers just updated, and sends the same
 * payload to the topic's channel and its cycle's board channel.
 *
 * Never throws and never delays the request: live updates are a nicety and
 * the 15s poll covers anyone who misses one.
 */
export function broadcastTopicChange(topicId: string, changed: LiveChange[]): void {
  after(async () => {
    try {
      const admin = createAdminClient()
      const counts = await readCounts(admin, topicId)
      if (!counts) return
      const payload: LiveUpdate = { topic_id: topicId, changed, counts: counts.live }
      await Promise.all([
        send(admin, topicChannel(topicId), payload),
        send(admin, boardChannel(counts.cycleId), payload),
      ])
    } catch (err) {
      console.warn('broadcastTopicChange failed', err)
    }
  })
}

/** A board-wide change with no single topic, e.g. GuildBot posting a batch. */
export function broadcastBoardChange(cycleId: string): void {
  after(async () => {
    try {
      const payload: LiveUpdate = { topic_id: null, changed: ['topics'], counts: null }
      await send(createAdminClient(), boardChannel(cycleId), payload)
    } catch (err) {
      console.warn('broadcastBoardChange failed', err)
    }
  })
}

async function readCounts(admin: Admin, topicId: string): Promise<{ cycleId: string; live: LiveCounts } | null> {
  const [{ data: topic }, { data: signals }, { data: poll }] = await Promise.all([
    admin.from('topics').select('cycle_id, vote_count, comment_count, score').eq('id', topicId).maybeSingle(),
    admin.from('topic_signals').select('signal').eq('topic_id', topicId),
    admin.from('topic_polls').select('total_votes').eq('topic_id', topicId).maybeSingle(),
  ])
  if (!topic) return null

  const signal_counts: Record<string, number> = {}
  for (const row of signals ?? []) signal_counts[row.signal] = (signal_counts[row.signal] ?? 0) + 1

  return {
    cycleId: topic.cycle_id,
    live: {
      vote_count: topic.vote_count,
      comment_count: topic.comment_count,
      score: Number(topic.score),
      signal_counts,
      poll_total: poll?.total_votes ?? null,
    },
  }
}

async function send(admin: Admin, name: string, payload: LiveUpdate) {
  const channel = admin.channel(name, { config: { private: true } })
  try {
    const res = await channel.httpSend(LIVE_EVENT, payload)
    if (!res.success) console.warn(`broadcast to ${name} failed: ${res.status} ${res.error}`)
  } finally {
    await admin.removeChannel(channel)
  }
}
