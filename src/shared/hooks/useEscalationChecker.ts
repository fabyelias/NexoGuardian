import { useEffect, useRef } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useAlertStore } from '@/shared/stores/alertStore'

const CHECK_INTERVAL    = 2 * 60_000  // check every 2 minutes
const ESCALATION_AFTER  = 5 * 60_000  // escalate if no supervisor responds in 5 minutes
const RE_ESCALATE_AFTER = 10 * 60_000 // re-escalate every 10 minutes if still unattended

// Only runs for admin/super_admin — alerts when a supervisor hasn't responded to a panic.
export function useEscalationChecker() {
  const { profile }  = useAuthStore()
  const addAlert     = useAlertStore((s) => s.addAlert)
  // Map<incidentId, lastEscalatedAt>
  const escalatedAt  = useRef(new Map<string, number>())

  useEffect(() => {
    if (!profile?.organization_id) return
    if (!['super_admin', 'admin'].includes(profile.role)) return

    async function check() {
      const escalationCutoff = new Date(Date.now() - ESCALATION_AFTER).toISOString()

      // Open panics older than ESCALATION_AFTER
      const { data: panics } = await supabase
        .from('incidents')
        .select('id, title, lat, lng, created_at')
        .eq('organization_id', profile!.organization_id)
        .eq('is_panic', true)
        .in('status', ['open', 'in_progress'])
        .lte('created_at', escalationCutoff)

      if (!panics?.length) return

      for (const panic of panics) {
        const lastEscalated = escalatedAt.current.get(panic.id) ?? 0
        const shouldEscalate = Date.now() - lastEscalated > RE_ESCALATE_AFTER

        if (!shouldEscalate) continue

        // Check if any supervisor acknowledged
        const { data: notifs } = await supabase
          .from('notifications')
          .select('user_id, is_read')
          .eq('reference_id', panic.id)
          .eq('type', 'panic')

        if (!notifs?.length) continue

        const supervisorNotifs = notifs.filter((n) => n.user_id !== profile!.id)
        const anyResponded     = supervisorNotifs.some((n) => n.is_read)

        if (anyResponded) {
          escalatedAt.current.delete(panic.id) // clear — someone responded
          continue
        }

        escalatedAt.current.set(panic.id, Date.now())

        const minutesElapsed = Math.floor(
          (Date.now() - new Date(panic.created_at).getTime()) / 60_000
        )
        const unrespondedCount = supervisorNotifs.filter((n) => !n.is_read).length

        addAlert({
          type: 'panic',
          title: '⚠️ PÁNICO SIN ATENDER',
          message: `Hace ${minutesElapsed} min — "${panic.title.replace('🚨 PÁNICO — ', '')}" sin respuesta de ${unrespondedCount} supervisor${unrespondedCount !== 1 ? 'es' : ''}`,
          incidentId: panic.id,
          lat: panic.lat ?? null,
          lng: panic.lng ?? null,
        })
      }
    }

    check() // immediate on mount
    const interval = setInterval(check, CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [profile?.id, profile?.role, profile?.organization_id]) // eslint-disable-line react-hooks/exhaustive-deps
}
