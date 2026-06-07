import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { Checkpoint } from '@/shared/types/models'

export function useCheckpoints(siteId: string) {
  const { profile } = useAuthStore()

  return useQuery({
    queryKey: ['checkpoints', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkpoints')
        .select('*')
        .eq('site_id', siteId)
        .eq('organization_id', profile!.organization_id)
        .order('order_index')
      if (error) throw error
      return data as Checkpoint[]
    },
    enabled: !!siteId && !!profile,
  })
}

export function useCreateCheckpoint() {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async (values: { site_id: string; name: string; description?: string }) => {
      const qr_code = crypto.randomUUID()
      const { data: existing } = await supabase
        .from('checkpoints')
        .select('order_index')
        .eq('site_id', values.site_id)
        .order('order_index', { ascending: false })
        .limit(1)
        .single()

      const order_index = existing ? (existing.order_index ?? 0) + 1 : 0

      const { data, error } = await supabase
        .from('checkpoints')
        .insert({
          site_id: values.site_id,
          organization_id: profile!.organization_id,
          name: values.name,
          description: values.description || null,
          qr_code,
          order_index,
        })
        .select()
        .single()
      if (error) throw error
      return data as Checkpoint
    },
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ['checkpoints', vars.site_id] }),
  })
}

export function useUpdateCheckpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, site_id, ...values }: Partial<Checkpoint> & { id: string; site_id: string }) => {
      const { data, error } = await supabase
        .from('checkpoints')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Checkpoint
    },
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ['checkpoints', data.site_id] }),
  })
}

export function useDeleteCheckpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, site_id }: { id: string; site_id: string }) => {
      const { error } = await supabase.from('checkpoints').delete().eq('id', id)
      if (error) throw error
      return site_id
    },
    onSuccess: (site_id) => queryClient.invalidateQueries({ queryKey: ['checkpoints', site_id] }),
  })
}
