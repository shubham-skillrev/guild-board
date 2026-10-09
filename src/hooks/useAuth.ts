'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  supabaseUser: SupabaseUser | null
  isAdmin: boolean
  isLoading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    supabaseUser: null,
    isAdmin: false,
    isLoading: true,
  })

  const fetchUser = useCallback(async (supabaseUser: SupabaseUser | null) => {
    if (!supabaseUser) {
      setState({ user: null, supabaseUser: null, isAdmin: false, isLoading: false })
      return
    }
    const supabase = createClient()
    // Not '*': real_name and email are not readable by members (028).
    const { data } = await supabase
      .from('users')
      .select('id, username, role, spark_count, hall_of_flame, is_system, created_at')
      .eq('id', supabaseUser.id)
      .single()

    setState({
      user: data ?? null,
      supabaseUser,
      isAdmin: data?.role === 'admin',
      isLoading: false,
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      fetchUser(user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        fetchUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchUser])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }, [])

  return { ...state, signOut }
}
