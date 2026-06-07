import { useState } from 'react'
import { Siren, Loader2 } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useGPS } from '@/shared/hooks/useGPS'
import { useAlertStore } from '@/shared/stores/alertStore'

interface PanicButtonProps {
  shiftId?: string
  siteId?: string
}

export function PanicButton({ shiftId, siteId }: PanicButtonProps) {
  const { profile } = useAuthStore()
  const { position, requestPosition } = useGPS()
  const { addAlert } = useAlertStore()
  const [isActivating, setIsActivating] = useState(false)
  const [activated, setActivated] = useState(false)
  const [holdTimer, setHoldTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseDown() {
    requestPosition()
    const timer = setTimeout(async () => {
      await activatePanic()
    }, 2000)
    setHoldTimer(timer)
  }

  function handleMouseUp() {
    if (holdTimer) {
      clearTimeout(holdTimer)
      setHoldTimer(null)
    }
  }

  async function activatePanic() {
    if (!profile || activated) return
    setIsActivating(true)

    const { data } = await supabase.from('incidents').insert({
      organization_id: profile.organization_id,
      site_id: siteId ?? '',
      reported_by: profile.id,
      category: 'other',
      severity: 'critical',
      title: `🚨 PÁNICO — ${profile.first_name} ${profile.last_name}`,
      description: `Alerta de pánico activada por el vigilador ${profile.first_name} ${profile.last_name}. Badge: ${profile.badge_number ?? 'N/A'}`,
      is_panic: true,
      shift_id: shiftId ?? null,
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
    }).select().single()

    if (data) {
      addAlert({
        type: 'panic',
        title: '🚨 PÁNICO ACTIVADO',
        message: `${profile.first_name} ${profile.last_name} activó el botón de pánico`,
        incidentId: data.id,
        guardId: profile.id,
      })
    }

    setActivated(true)
    setIsActivating(false)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        disabled={isActivating || activated}
        className={`
          relative flex h-28 w-28 flex-col items-center justify-center rounded-full
          border-4 font-bold text-white transition-all duration-200
          select-none touch-none
          ${activated
            ? 'border-red-600 bg-red-600/20 text-red-400 cursor-not-allowed'
            : 'border-red-600 bg-red-600/10 hover:bg-red-600/20 active:scale-95 active:bg-red-600/30 cursor-pointer'
          }
        `}
      >
        {isActivating ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : (
          <>
            <Siren className="h-8 w-8" />
            <span className="text-xs mt-1">{activated ? 'ACTIVADO' : 'PÁNICO'}</span>
          </>
        )}
      </button>
      <p className="text-xs text-zinc-600 text-center max-w-xs">
        {activated
          ? 'Alerta enviada. Los supervisores han sido notificados.'
          : 'Mantené presionado 2 segundos para activar la alerta de emergencia'}
      </p>
    </div>
  )
}
