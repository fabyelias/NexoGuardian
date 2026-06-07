import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { Profile } from '@/shared/types/models'
import type { UserRole } from '@/shared/types/enums'

export function usePersonnel(role?: UserRole) {
  const { profile } = useAuthStore()
  const orgId = profile?.organization_id

  return useQuery({
    queryKey: ['personnel', orgId, role],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', orgId!)
        .order('first_name')

      if (role) query = query.eq('role', role)

      const { data, error } = await query
      if (error) throw error
      return data as Profile[]
    },
    enabled: !!orgId,
  })
}

export interface CreatePersonnelInput {
  email: string
  password: string
  first_name: string
  last_name: string
  role: UserRole
  phone?: string
  badge_number?: string
  id_document?: string
  address?: string
}

export function useCreatePersonnel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: CreatePersonnelInput) => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: values,
      })
      // Check the actual body error first (more descriptive than the SDK wrapper)
      if (data?.error) throw new Error(data.error)
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personnel'] }),
  })
}

export function useUpdatePersonnel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Profile> & { id: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Profile
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personnel'] }),
  })
}

export function useDeletePersonnel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personnel'] }),
  })
}

export function useTogglePersonnelStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('profiles').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personnel'] }),
  })
}
