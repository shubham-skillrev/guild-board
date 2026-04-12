import { CATEGORY_BONUS } from '@/lib/constants'
import type { Topic, TopicScore } from '@/types'

export function calculateScore(
  votes: number,
  contribs: number,
  category: string
): number {
  const base = votes * 1 + contribs * 2
  const bonus = base * (CATEGORY_BONUS[category] ?? 0)
  return parseFloat((base + bonus).toFixed(2))
}

export function rankTopics(topics: Topic[]): Topic[] {
  return [...topics].sort((a, b) => b.score - a.score)
}

export function getTopicScore(topic: Topic): TopicScore {
  const base = topic.vote_count * 1 + topic.contrib_count * 2
  const bonus = base * (CATEGORY_BONUS[topic.category] ?? 0)
  return {
    topic_id: topic.id,
    raw_votes: topic.vote_count,
    raw_contribs: topic.contrib_count,
    category_bonus: parseFloat(bonus.toFixed(2)),
    final_score: parseFloat((base + bonus).toFixed(2)),
  }
}
