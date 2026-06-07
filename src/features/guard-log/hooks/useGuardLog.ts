import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { GuardLog } from '@/shared/types/models'

export function useGuardLogs(filters?: { shiftId?: string; siteId?: string; guardId?: string }) {
  const { profile } = useAuthStore()
  const orgId = profile?.organization_id

  return useQuery({
    queryKey: ['guard-logs', orgId, filters],
    queryFn: async () => {
      let query = supabase
        .from('guard_logs')
        .select('*, guard:profiles!guard_id(first_name, last_name, badge_number), site:sites(name)')
        .eq('organization_id', orgId!)
        .order('recorded_at', { ascending: false })

      if (filters?.shiftId) query = query.eq('shift_id', filters.shiftId)
      if (filters?.siteId) query = query.eq('site_id', filters.siteId)
      if (filters?.guardId) query = query.eq('guard_id', filters.guardId)

      const { data, error } = await query.limit(100)
      if (error) throw error
      return data as GuardLog[]
    },
    enabled: !!orgId,
  })
}

export function useCreateGuardLog() {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async ({
      shiftId, siteId, content, aiEnhanced, lat, lng,
    }: {
      shiftId: string; siteId: string; content: string; aiEnhanced?: string; lat?: number; lng?: number
    }) => {
      const { data, error } = await supabase.from('guard_logs').insert({
        organization_id: profile!.organization_id,
        guard_id: profile!.id,
        shift_id: shiftId,
        site_id: siteId,
        content,
        ai_enhanced: aiEnhanced ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        recorded_at: new Date().toISOString(),
      }).select().single()
      if (error) throw error
      return data as GuardLog
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guard-logs'] }),
  })
}

export function useUpdateGuardLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, content, ai_enhanced }: { id: string; content: string; ai_enhanced?: string }) => {
      const { data, error } = await supabase
        .from('guard_logs')
        .update({ content, ai_enhanced: ai_enhanced ?? null })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as GuardLog
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guard-logs'] }),
  })
}
