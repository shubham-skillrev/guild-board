'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserTokens } from '@/types'
import { TOKEN_LIMITS } from '@/lib/constants'
import { FOCUS_FORMAT } from '@/lib/experiment'

interface UserTokensState extends UserTokens {
  isLoading: boolean
}

export function useUserTokens(cycleId: string | null | undefined) {
  const [state, setState] = useState<UserTokensState>({
    votes_remaining: TOKEN_LIMITS.VOTES_PER_CYCLE,
    contribs_remaining: TOKEN_LIMITS.CONTRIBS_PER_CYCLE,
    spark_given: false,
    topics_remaining: TOKEN_LIMITS.TOPICS_PER_CYCLE,
    isLoading: true,
  })

  const refresh = useCallback(async () => {
    if (!cycleId) {
      setState(s => ({ ...s, isLoading: false }))
      return
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setState(s => ({ ...s, isLoading: false })); return }

    const [{ data: votes }, { data: contribs }, { data: sparks }, { data: topicCountRaw }] =
      await Promise.all([
        supabase.from('votes').select('id').eq('user_id', user.id).eq('cycle_id', cycleId).limit(TOKEN_LIMITS.VOTES_PER_CYCLE),
        supabase.from('contributions').select('id').eq('user_id', user.id).eq('cycle_id', cycleId).limit(TOKEN_LIMITS.CONTRIBS_PER_CYCLE),
        supabase.from('sparks').select('id').eq('from_user_id', user.id).eq('cycle_id', cycleId).limit(1),
        // topics.user_id is hidden from members (028), so the count comes from
        // an RPC that applies the same rule as the trigger (migration 027).
        supabase.rpc('my_topic_count', { p_cycle_id: cycleId }),
      ])

    const voteCount = votes?.length ?? 0
    const contribCount = contribs?.length ?? 0
    const sparkCount = sparks?.length ?? 0
    const topicCount = typeof topicCountRaw === 'number' ? topicCountRaw : 0

    setState({
      // Problem Month drops both caps (migration 023), so nothing runs out.
      votes_remaining: FOCUS_FORMAT ? Infinity : TOKEN_LIMITS.VOTES_PER_CYCLE - (voteCount ?? 0),
      contribs_remaining: FOCUS_FORMAT ? Infinity : TOKEN_LIMITS.CONTRIBS_PER_CYCLE - (contribCount ?? 0),
      spark_given: (sparkCount ?? 0) > 0,
      topics_remaining: Math.max(0, TOKEN_LIMITS.TOPICS_PER_CYCLE - topicCount),
      isLoading: false,
    })
  }, [cycleId])

  useEffect(() => { refresh() }, [refresh])

  return { ...state, refresh }
}
