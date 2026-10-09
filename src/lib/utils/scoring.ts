import { CATEGORY_BONUS } from '@/lib/constants'
import type { Topic, TopicScore } from '@/types'

// Votes only. "I can help" was retired (migration 029); contrib_count is kept
// for history but no longer moves a topic up the board.
export function calculateScore(
  votes: number,
  category: string
): number {
  const base = votes
  const bonus = base * (CATEGORY_BONUS[category] ?? 0)
  return parseFloat((base + bonus).toFixed(2))
}

export function rankTopics(topics: Topic[]): Topic[] {
  return [...topics].sort((a, b) => b.score - a.score)
}

export function getTopicScore(topic: Topic): TopicScore {
  const base = topic.vote_count
  const bonus = base * (CATEGORY_BONUS[topic.category] ?? 0)
  return {
    topic_id: topic.id,
    raw_votes: topic.vote_count,
    category_bonus: parseFloat(bonus.toFixed(2)),
    final_score: parseFloat((base + bonus).toFixed(2)),
  }
}
