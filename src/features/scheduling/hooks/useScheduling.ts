import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { Shift } from '@/shared/types/models'

export function useWeekShifts(weekStart: Date) {
  const { profile } = useAuthStore()
  const orgId = profile?.organization_id

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  return useQuery({
    queryKey: ['shifts', 'week', orgId, weekStart.toISOString().split('T')[0]],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*, guard:profiles!guard_id(id, first_name, last_name, badge_number, avatar_url), site:sites(id, name)')
        .eq('organization_id', orgId!)
        .gte('scheduled_start', weekStart.toISOString())
        .lt('scheduled_start', weekEnd.toISOString())
        .order('scheduled_start', { ascending: true })

      if (error) throw error
      return data as Shift[]
    },
    enabled: !!orgId,
    refetchInterval: 60_000,
  })
}

export function useGuardMonthShifts(guardId: string) {
  const { profile } = useAuthStore()
  const orgId = profile?.organization_id

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return useQuery({
    queryKey: ['shifts', 'guard-month', orgId, guardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*, site:sites(id, name)')
        .eq('organization_id', orgId!)
        .eq('guard_id', guardId)
        .gte('scheduled_start', monthStart.toISOString())
        .lt('scheduled_start', monthEnd.toISOString())
        .order('scheduled_start', { ascending: false })

      if (error) throw error
      return data as Shift[]
    },
    enabled: !!orgId && !!guardId,
  })
}

export function useCreateShift() {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async (input: {
      guard_id: string
      site_id: string
      scheduled_start: string
      scheduled_end: string
      notes?: string
    }) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert({ organization_id: profile!.organization_id, ...input, status: 'scheduled' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] }),
  })
}

export function useUpdateShift() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string
      guard_id?: string
      site_id?: string
      scheduled_start?: string
      scheduled_end?: string
      status?: string
      notes?: string
    }) => {
      const { data, error } = await supabase
        .from('shifts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] }),
  })
}

export function useDeleteShift() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shifts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] }),
  })
}
