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

export function useCreatePersonnel() {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async (values: {
      email: string
      password: string
      first_name: string
      last_name: string
      role: UserRole
      phone?: string
      badge_number?: string
      id_document?: string
      address?: string
    }) => {
      const { email, password, ...profileData } = values

      const { data: authData, error: authError } = await supabase.auth.admin
        ? supabase.functions.invoke('create-user', { body: { email, password, ...profileData, organization_id: profile!.organization_id } })
        : { data: null, error: new Error('Use Supabase dashboard') }

      if (authError) throw authError
      return authData
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

export function useTogglePersonnelStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personnel'] }),
  })
}
