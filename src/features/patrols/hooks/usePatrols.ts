import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { PatrolSession, PatrolPoint, Checkpoint } from '@/shared/types/models'

export function usePatrols() {
  const { profile } = useAuthStore()
  const orgId = profile?.organization_id

  return useQuery({
    queryKey: ['patrols', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patrol_sessions')
        .select('*, site:sites(name), guard:profiles!guard_id(first_name, last_name)')
        .eq('organization_id', orgId!)
        .order('started_at', { ascending: false })
      if (error) throw error
      return data as PatrolSession[]
    },
    enabled: !!orgId,
  })
}

export function usePatrolDetail(id: string) {
  return useQuery({
    queryKey: ['patrol', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patrol_sessions')
        .select('*, site:sites(name), guard:profiles!guard_id(first_name, last_name), points:patrol_points(*, checkpoint:checkpoints(name, description))')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as PatrolSession
    },
    enabled: !!id,
  })
}

export function useCheckpoints(siteId?: string) {
  return useQuery({
    queryKey: ['checkpoints', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkpoints')
        .select('*')
        .eq('site_id', siteId!)
        .eq('is_active', true)
        .order('order_index')
      if (error) throw error
      return data as Checkpoint[]
    },
    enabled: !!siteId,
  })
}

export function useStartPatrol() {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async ({ siteId, shiftId, totalCheckpoints }: { siteId: string; shiftId?: string; totalCheckpoints: number }) => {
      const { data, error } = await supabase
        .from('patrol_sessions')
        .insert({
          organization_id: profile!.organization_id,
          site_id: siteId,
          guard_id: profile!.id,
          shift_id: shiftId ?? null,
          status: 'in_progress',
          total_checkpoints: totalCheckpoints,
        })
        .select()
        .single()
      if (error) throw error
      return data as PatrolSession
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patrols'] }),
  })
}

export function useScanCheckpoint() {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async ({ patrolSessionId, checkpointId, lat, lng, notes }: {
      patrolSessionId: string; checkpointId: string; lat?: number; lng?: number; notes?: string
    }) => {
      const { data: point, error } = await supabase
        .from('patrol_points')
        .insert({ patrol_session_id: patrolSessionId, checkpoint_id: checkpointId, guard_id: profile!.id, lat, lng, notes })
        .select()
        .single()
      if (error) throw error

      const { data: session } = await supabase
        .from('patrol_sessions')
        .select('visited_checkpoints, total_checkpoints')
        .eq('id', patrolSessionId)
        .single()

      if (session) {
        const visited = (session.visited_checkpoints ?? 0) + 1
        const isComplete = visited >= session.total_checkpoints
        await supabase.from('patrol_sessions').update({
          visited_checkpoints: visited,
          ...(isComplete ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
        }).eq('id', patrolSessionId)
      }

      return point as PatrolPoint
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['patrol', vars.patrolSessionId] })
      queryClient.invalidateQueries({ queryKey: ['patrols'] })
    },
  })
}

export function useCompletePatrol() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('patrol_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
    },
    onSuccess: (_d, id) => {
      queryClient.invalidateQueries({ queryKey: ['patrol', id] })
      queryClient.invalidateQueries({ queryKey: ['patrols'] })
    },
  })
}
