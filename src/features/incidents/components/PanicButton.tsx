import { useState } from 'react'
import { Siren, Loader2, MapPin } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useAlertStore } from '@/shared/stores/alertStore'

interface PanicButtonProps {
  shiftId?: string
  siteId?: string
}

function getCurrentPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    )
  })
}

export function PanicButton({ shiftId, siteId }: PanicButtonProps) {
  const { profile } = useAuthStore()
  const { addAlert } = useAlertStore()
  const [isActivating, setIsActivating] = useState(false)
  const [activated, setActivated] = useState(false)
  const [holdTimer, setHoldTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')

  function handleStart() {
    setGpsStatus('loading')
    const timer = setTimeout(async () => {
      await activatePanic()
    }, 2000)
    setHoldTimer(timer)
  }

  function handleEnd() {
    if (holdTimer) {
      clearTimeout(holdTimer)
      setHoldTimer(null)
      setGpsStatus('idle')
    }
  }

  async function activatePanic() {
    if (!profile || activated) return
    setIsActivating(true)

    // Wait for GPS before creating the incident
    const pos = await getCurrentPosition()
    const lat = pos?.coords.latitude ?? null
    const lng = pos?.coords.longitude ?? null
    setGpsStatus(lat !== null ? 'ok' : 'denied')

    const { data, error } = await supabase.from('incidents').insert({
      organization_id: profile.organization_id,
      site_id: siteId ?? null,
      reported_by: profile.id,
      category: 'other',
      severity: 'critical',
      title: `🚨 PÁNICO — ${profile.first_name} ${profile.last_name}`,
      description: `Alerta de pánico activada por ${profile.first_name} ${profile.last_name} (Legajo: ${profile.badge_number ?? 'N/A'}).${lat ? ` Ubicación: ${lat.toFixed(6)}, ${lng!.toFixed(6)}` : ' Ubicación no disponible.'}`,
      is_panic: true,
      shift_id: shiftId ?? null,
      lat,
      lng,
    }).select().single()

    if (data && !error) {
      // Notify supervisors/admins via Edge Function
      await supabase.functions.invoke('panic-alert', {
        body: {
          incidentId: data.id,
          guardId: profile.id,
          organizationId: profile.organization_id,
        },
      })

      addAlert({
        type: 'panic',
        title: '🚨 PÁNICO ACTIVADO',
        message: `${profile.first_name} ${profile.last_name} activó el botón de pánico`,
        incidentId: data.id,
        guardId: profile.id,
        lat,
        lng,
      })
    }

    setActivated(true)
    setIsActivating(false)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        disabled={isActivating || activated}
        className={`
          relative flex h-32 w-32 flex-col items-center justify-center rounded-full
          border-4 font-bold text-white transition-all duration-200
          select-none touch-none
          ${activated
            ? 'border-red-600 bg-red-600/20 text-red-400 cursor-not-allowed'
            : 'border-red-600 bg-red-600/10 hover:bg-red-600/20 active:scale-95 active:bg-red-600/30 cursor-pointer'
          }
        `}
      >
        {isActivating ? (
          <Loader2 className="h-10 w-10 animate-spin text-red-400" />
        ) : (
          <>
            <Siren className={`h-10 w-10 ${activated ? 'text-red-400' : 'text-red-500'}`} />
            <span className="text-xs mt-1 font-bold tracking-widest">
              {activated ? 'ENVIADO' : 'PÁNICO'}
            </span>
          </>
        )}
        {/* Pulse ring while holding */}
        {holdTimer && (
          <span className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-75" />
        )}
      </button>

      {/* GPS status */}
      {gpsStatus === 'loading' && (
        <p className="flex items-center gap-1.5 text-xs text-amber-400">
          <MapPin className="h-3 w-3 animate-pulse" /> Obteniendo ubicación…
        </p>
      )}
      {gpsStatus === 'ok' && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400">
          <MapPin className="h-3 w-3" /> Ubicación capturada
        </p>
      )}
      {gpsStatus === 'denied' && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <MapPin className="h-3 w-3" /> Sin permiso de ubicación
        </p>
      )}

      <p className="text-xs text-zinc-500 text-center max-w-xs px-4">
        {activated
          ? 'Alerta enviada. Los supervisores han sido notificados.'
          : 'Mantené presionado 2 segundos para activar la alerta de emergencia'}
      </p>
    </div>
  )
}
