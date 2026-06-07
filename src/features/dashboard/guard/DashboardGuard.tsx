import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Square,
  AlertTriangle,
  MapPin,
  Clock,
  BookOpen,
  Route,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useGPS } from '@/shared/hooks/useGPS'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { PanicButton } from '@/features/incidents/components/PanicButton'
import type { Shift } from '@/shared/types/models'
import { formatDate } from '@/shared/lib/utils'

export function DashboardGuard() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const { position, requestPosition } = useGPS()
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    requestPosition()
    loadActiveShift()
  }, [profile?.id])

  async function loadActiveShift() {
    const { data } = await supabase
      .from('shifts')
      .select('*, site:sites(name, address)')
      .eq('guard_id', profile!.id)
      .eq('status', 'active')
      .maybeSingle()

    setActiveShift(data as Shift | null)
    setIsLoading(false)
  }

  async function startShift() {
    setIsStarting(true)
    const { data: scheduled } = await supabase
      .from('shifts')
      .select('*')
      .eq('guard_id', profile!.id)
      .eq('status', 'scheduled')
      .order('scheduled_start', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!scheduled) {
      setIsStarting(false)
      return
    }

    const { data } = await supabase
      .from('shifts')
      .update({
        status: 'active',
        actual_start: new Date().toISOString(),
        start_lat: position?.lat ?? null,
        start_lng: position?.lng ?? null,
      })
      .eq('id', scheduled.id)
      .select('*, site:sites(name, address)')
      .single()

    setActiveShift(data as Shift)
    setIsStarting(false)
  }

  async function endShift() {
    if (!activeShift) return
    setIsEnding(true)

    await supabase
      .from('shifts')
      .update({
        status: 'completed',
        actual_end: new Date().toISOString(),
        end_lat: position?.lat ?? null,
        end_lng: position?.lng ?? null,
      })
      .eq('id', activeShift.id)

    setActiveShift(null)
    setIsEnding(false)
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* Shift status */}
      <Card className={activeShift ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-white/8'}>
        <CardContent className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : activeShift ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-emerald-400">Turno Activo</span>
                </div>
                <Badge variant="success">En servicio</Badge>
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  {(activeShift.site as { name: string } | undefined)?.name}
                </p>
                <p className="text-sm text-zinc-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {(activeShift.site as { address: string } | undefined)?.address}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="h-3.5 w-3.5" />
                Inicio: {activeShift.actual_start ? formatDate(activeShift.actual_start) : '—'}
              </div>
              <Button
                variant="outline"
                className="w-full border-red-800/30 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                onClick={endShift}
                disabled={isEnding}
              >
                {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                Finalizar Turno
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Sin turno activo</p>
              <Button className="w-full" onClick={startShift} disabled={isStarting}>
                {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Iniciar Turno
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      {activeShift && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/incidents/new')}
            className="flex flex-col items-center gap-2 rounded-xl border border-white/8 bg-zinc-900/60 p-4 hover:bg-white/5 transition-colors"
          >
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <span className="text-xs text-zinc-300">Reportar Incidente</span>
          </button>
          <button
            onClick={() => navigate('/patrols/new')}
            className="flex flex-col items-center gap-2 rounded-xl border border-white/8 bg-zinc-900/60 p-4 hover:bg-white/5 transition-colors"
          >
            <Route className="h-6 w-6 text-blue-400" />
            <span className="text-xs text-zinc-300">Iniciar Rondín</span>
          </button>
          <button
            onClick={() => navigate('/guard-log')}
            className="flex flex-col items-center gap-2 rounded-xl border border-white/8 bg-zinc-900/60 p-4 hover:bg-white/5 transition-colors"
          >
            <BookOpen className="h-6 w-6 text-violet-400" />
            <span className="text-xs text-zinc-300">Libro de Guardia</span>
          </button>
          <button
            onClick={() => {
              requestPosition()
            }}
            className="flex flex-col items-center gap-2 rounded-xl border border-white/8 bg-zinc-900/60 p-4 hover:bg-white/5 transition-colors"
          >
            <MapPin className={`h-6 w-6 ${position ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="text-xs text-zinc-300">
              {position ? 'GPS Activo' : 'Obtener GPS'}
            </span>
          </button>
        </div>
      )}

      {/* Panic button */}
      <PanicButton shiftId={activeShift?.id} siteId={activeShift?.site_id} />
    </div>
  )
}
