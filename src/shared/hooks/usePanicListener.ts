import { useEffect } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useAlertStore } from '@/shared/stores/alertStore'

// Mounted for admin/supervisor roles — listens for new panic incidents in real time
export function usePanicListener() {
  const { profile } = useAuthStore()
  const addAlert = useAlertStore((s) => s.addAlert)

  useEffect(() => {
    if (!profile?.organization_id) return
    if (!['super_admin', 'admin', 'supervisor'].includes(profile.role)) return

    const channelId = `panic-${profile.organization_id}`

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incidents',
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        (payload) => {
          const incident = payload.new as {
            id: string
            is_panic: boolean
            title: string
            reported_by: string
            lat: number | null
            lng: number | null
          }
          if (!incident.is_panic) return

          addAlert({
            type: 'panic',
            title: '🚨 ALERTA DE PÁNICO',
            message: incident.title.replace('🚨 PÁNICO — ', ''),
            incidentId: incident.id,
            guardId: incident.reported_by,
            lat: incident.lat,
            lng: incident.lng,
          })

          // Native browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 ALERTA DE PÁNICO', {
              body: incident.title,
              tag: incident.id,
            })
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.organization_id, profile?.role, addAlert])
}
