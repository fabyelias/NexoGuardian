import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { Site } from '@/shared/types/models'

export function useSites() {
  const { profile } = useAuthStore()
  const orgId = profile?.organization_id

  return useQuery({
    queryKey: ['sites', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('organization_id', orgId!)
        .order('name')
      if (error) throw error
      return data as Site[]
    },
    enabled: !!orgId,
  })
}

export function useCreateSite() {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async (values: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('sites')
        .insert({ ...values, organization_id: profile!.organization_id })
        .select()
        .single()
      if (error) throw error
      return data as Site
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sites'] }),
  })
}

export function useUpdateSite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Site> & { id: string }) => {
      const { data, error } = await supabase
        .from('sites')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Site
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sites'] }),
  })
}

export function useDeleteSite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sites').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sites'] }),
  })
}
