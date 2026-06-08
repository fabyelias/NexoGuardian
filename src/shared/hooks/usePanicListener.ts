import { useEffect, useRef } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useAlertStore } from '@/shared/stores/alertStore'

const POLL_INTERVAL = 10_000      // check every 10 seconds
const LOOKBACK_MINUTES = 60       // on mount, look back 60 min for unread panics

// Polls the notifications table every 10s for the current user's unread panic alerts.
// Polling is more reliable than postgres_changes which requires Realtime publication setup.
export function usePanicListener() {
  const { profile } = useAuthStore()
  const addAlert    = useAlertStore((s) => s.addAlert)
  const alerts      = useAlertStore((s) => s.alerts)
  const shownIds    = useRef(new Set<string>())
  const since       = useRef(new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString())

  useEffect(() => {
    if (!profile?.id) return
    if (!['super_admin', 'admin', 'supervisor'].includes(profile.role)) return

    // Seed shownIds from already-active alerts so we don't re-show them
    shownIds.current = new Set(
      alerts.filter((a) => a.type === 'panic' && a.incidentId).map((a) => a.incidentId!)
    )

    async function poll() {
      // 1. Query unread panic notifications for this user
      const { data: notifs } = await supabase
        .from('notifications')
        .select('id, reference_id, body, created_at')
        .eq('user_id', profile!.id)
        .eq('type', 'panic')
        .eq('is_read', false)
        .gte('created_at', since.current)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!notifs?.length) return

      // 2. Fetch incident details for all new panics at once
      const newIds = notifs
        .map((n) => n.reference_id as string)
        .filter((id) => id && !shownIds.current.has(id))

      if (!newIds.length) return

      const { data: incidents } = await supabase
        .from('incidents')
        .select('id, title, lat, lng, reported_by')
        .in('id', newIds)

      const incidentMap = new Map((incidents ?? []).map((i) => [i.id, i]))

      for (const notif of notifs) {
        const incidentId = notif.reference_id as string
        if (!incidentId || shownIds.current.has(incidentId)) continue
        const incident = incidentMap.get(incidentId)
        if (!incident) continue

        shownIds.current.add(incidentId)

        addAlert({
          type: 'panic',
          title: '🚨 ALERTA DE PÁNICO',
          message: incident.title.replace('🚨 PÁNICO — ', ''),
          incidentId: incident.id,
          guardId: incident.reported_by,
          lat: incident.lat ?? null,
          lng: incident.lng ?? null,
        })

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🚨 ALERTA DE PÁNICO', {
            body: incident.title,
            tag: incident.id,
          })
        }
      }

      // Advance the since cursor so next poll only fetches newer records
      since.current = notifs[0].created_at
    }

    poll() // immediate first check
    const interval = setInterval(poll, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [profile?.id, profile?.role]) // eslint-disable-line react-hooks/exhaustive-deps
}
