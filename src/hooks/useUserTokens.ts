'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserTokens } from '@/types'
import { TOKEN_LIMITS } from '@/lib/constants'

interface UserTokensState extends UserTokens {
  isLoading: boolean
}

export function useUserTokens(cycleId: string | null | undefined) {
  const [state, setState] = useState<UserTokensState>({
    votes_remaining: TOKEN_LIMITS.VOTES_PER_CYCLE,
    contribs_remaining: TOKEN_LIMITS.CONTRIBS_PER_CYCLE,
    spark_given: false,
    topic_submitted: false,
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

    const [{ data: votes }, { data: contribs }, { data: sparks }, { data: topics }] =
      await Promise.all([
        supabase.from('votes').select('id').eq('user_id', user.id).eq('cycle_id', cycleId).limit(TOKEN_LIMITS.VOTES_PER_CYCLE),
        supabase.from('contributions').select('id').eq('user_id', user.id).eq('cycle_id', cycleId).limit(TOKEN_LIMITS.CONTRIBS_PER_CYCLE),
        supabase.from('sparks').select('id').eq('from_user_id', user.id).eq('cycle_id', cycleId).limit(1),
        supabase.from('topics').select('id').eq('user_id', user.id).eq('cycle_id', cycleId).eq('is_deleted', false).limit(1),
      ])

    const voteCount = votes?.length ?? 0
    const contribCount = contribs?.length ?? 0
    const sparkCount = sparks?.length ?? 0
    const topicCount = topics?.length ?? 0

    setState({
      votes_remaining: TOKEN_LIMITS.VOTES_PER_CYCLE - (voteCount ?? 0),
      contribs_remaining: TOKEN_LIMITS.CONTRIBS_PER_CYCLE - (contribCount ?? 0),
      spark_given: (sparkCount ?? 0) > 0,
      topic_submitted: (topicCount ?? 0) > 0,
      isLoading: false,
    })
  }, [cycleId])

  useEffect(() => { refresh() }, [refresh])

  return { ...state, refresh }
}
