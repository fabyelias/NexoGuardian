import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { Profile } from '@/shared/types/models'

export function useAuth() {
  const { user, session, profile, isLoading, setUser, setSession, setProfile, setLoading, reset } =
    useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProfile(userId: string) {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    setProfile(data as Profile | null)
    setLoading(false)
  }

  return { user, session, profile, isLoading }
}

export function useSignOut() {
  const navigate = useNavigate()
  const { reset } = useAuthStore()

  return async () => {
    await supabase.auth.signOut()
    reset()
    navigate('/login')
  }
}
