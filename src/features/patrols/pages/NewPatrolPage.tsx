import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, MapPin, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useSites } from '@/features/sites/hooks/useSites'
import { useCheckpoints, useStartPatrol } from '../hooks/usePatrols'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import type { Site } from '@/shared/types/models'

export function NewPatrolPage() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const { data: sites = [] } = useSites()
  const startPatrol = useStartPatrol()

  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [activeShiftId, setActiveShiftId] = useState<string | undefined>()
  const [loadingShift, setLoadingShift] = useState(true)

  const { data: checkpoints = [], isLoading: loadingCheckpoints } = useCheckpoints(selectedSiteId || undefined)

  // Load active shift to pre-fill the site
  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('shifts')
      .select('id, site_id')
      .eq('guard_id', profile.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActiveShiftId(data.id)
          setSelectedSiteId(data.site_id)
        }
        setLoadingShift(false)
      })
  }, [profile?.id])

  async function handleStart() {
    if (!selectedSiteId) return
    const session = await startPatrol.mutateAsync({
      siteId: selectedSiteId,
      shiftId: activeShiftId,
      totalCheckpoints: checkpoints.length,
    })
    navigate(`/patrols/scan/${session.id}`, { replace: true })
  }

  const selectedSite = sites.find(s => s.id === selectedSiteId)

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/patrols')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Rondines
      </button>

      <div>
        <h2 className="text-xl font-semibold text-white">Iniciar Rondín</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Seleccioná el objetivo y comenzá el recorrido</p>
      </div>

      {/* Site selector */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <label className="text-xs font-medium text-zinc-400">Objetivo *</label>
          {loadingShift ? (
            <div className="h-9 rounded-md bg-white/5 animate-pulse" />
          ) : (
            <select
              className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
            >
              <option value="">Seleccionar objetivo...</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {selectedSite?.address && (
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <MapPin className="h-3 w-3" />
              {selectedSite.address}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Checkpoints preview */}
      {selectedSiteId && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-zinc-400">Checkpoints del recorrido</p>
              {!loadingCheckpoints && (
                <span className="text-xs text-zinc-500">{checkpoints.length} punto{checkpoints.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {loadingCheckpoints ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-9 rounded bg-white/5 animate-pulse" />)}</div>
            ) : checkpoints.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-zinc-600">
                <QrCode className="h-8 w-8 mb-2" />
                <p className="text-sm text-zinc-500">Sin checkpoints configurados</p>
                <p className="text-xs text-zinc-600 mt-1">El rondín se registrará sin puntos de control QR</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {checkpoints.map((cp, i) => (
                  <div key={cp.id} className="flex items-center gap-3 rounded-md border border-white/5 bg-zinc-900/40 px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-xs font-medium text-zinc-500 shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-300">{cp.name}</p>
                      {cp.description && <p className="text-xs text-zinc-600 truncate">{cp.description}</p>}
                    </div>
                    <QrCode className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={handleStart}
        disabled={!selectedSiteId || startPatrol.isPending}
      >
        {startPatrol.isPending
          ? <Loader2 className="h-5 w-5 animate-spin" />
          : <QrCode className="h-5 w-5" />
        }
        {checkpoints.length > 0 ? 'Iniciar rondín con QR' : 'Iniciar rondín'}
      </Button>
    </div>
  )
}
