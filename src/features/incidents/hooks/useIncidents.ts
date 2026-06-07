import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { Incident, IncidentUpdate } from '@/shared/types/models'
import type { IncidentStatus } from '@/shared/types/enums'

export function useIncidents() {
  const { profile } = useAuthStore()
  const orgId = profile?.organization_id

  return useQuery({
    queryKey: ['incidents', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, site:sites(name), reporter:profiles!reported_by(first_name, last_name, badge_number)')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Incident[]
    },
    enabled: !!orgId,
  })
}

export function useIncident(id: string) {
  const { profile } = useAuthStore()

  return useQuery({
    queryKey: ['incident', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, site:sites(name, address), reporter:profiles!reported_by(first_name, last_name, badge_number), assignee:profiles!assigned_to(first_name, last_name)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Incident
    },
    enabled: !!id && !!profile,
  })
}

export function useIncidentUpdates(incidentId: string) {
  return useQuery({
    queryKey: ['incident-updates', incidentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incident_updates')
        .select('*, author:profiles!author_id(first_name, last_name)')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as IncidentUpdate[]
    },
    enabled: !!incidentId,
  })
}

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: IncidentStatus; note?: string }) => {
      await supabase.from('incidents').update({
        status,
        ...(status === 'resolved' || status === 'closed' ? { resolved_at: new Date().toISOString() } : {}),
      }).eq('id', id)

      if (note || status) {
        await supabase.from('incident_updates').insert({
          incident_id: id,
          author_id: profile!.id,
          content: note || `Estado actualizado a: ${status}`,
          status_change: status,
        })
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['incident', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['incident-updates', vars.id] })
    },
  })
}

export function useAddIncidentUpdate() {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()

  return useMutation({
    mutationFn: async ({ incidentId, content }: { incidentId: string; content: string }) => {
      const { error } = await supabase.from('incident_updates').insert({
        incident_id: incidentId,
        author_id: profile!.id,
        content,
      })
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['incident-updates', vars.incidentId] })
    },
  })
}
