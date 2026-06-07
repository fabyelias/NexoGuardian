import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, MapPin, QrCode, Loader2 } from 'lucide-react'
import { usePatrolDetail, useCompletePatrol } from '../hooks/usePatrols'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { formatDate } from '@/shared/lib/utils'

export function PatrolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: patrol, isLoading } = usePatrolDetail(id!)
  const complete = useCompletePatrol()

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
  if (!patrol) return null

  const points = (patrol.points ?? []) as Array<{ id: string; scanned_at: string; notes?: string; lat?: number; lng?: number; checkpoint: { name: string; description?: string } }>
  const progress = patrol.total_checkpoints > 0 ? Math.round((patrol.visited_checkpoints / patrol.total_checkpoints) * 100) : 0
  const guard = patrol.guard as { first_name: string; last_name: string } | undefined
  const site = patrol.site as { name: string } | undefined

  return (
    <div className="max-w-2xl space-y-6">
      <button onClick={() => navigate('/patrols')} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Volver a rondines
      </button>

      {/* Header */}
      <div className="rounded-xl border border-white/8 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{site?.name ?? '—'}</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              {guard ? `${guard.first_name} ${guard.last_name}` : '—'} · {formatDate(patrol.started_at)}
            </p>
          </div>
          <Badge variant={patrol.status === 'completed' ? 'success' : patrol.status === 'in_progress' ? 'warning' : 'destructive'}>
            {patrol.status === 'completed' ? 'Completado' : patrol.status === 'in_progress' ? 'En curso' : 'Incompleto'}
          </Badge>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Progreso del rondín</span>
            <span className="text-white font-medium">{patrol.visited_checkpoints}/{patrol.total_checkpoints} puntos ({progress}%)</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {patrol.status === 'in_progress' && (
          <Button variant="outline" size="sm" onClick={() => complete.mutate(id!)} disabled={complete.isPending}>
            {complete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Finalizar rondín
          </Button>
        )}
      </div>

      {/* Checkpoints visited */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
          Puntos escaneados ({points.length})
        </h3>
        {points.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-zinc-600">
            <QrCode className="h-10 w-10 mb-2" />
            <p className="text-sm">Sin puntos escaneados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {points.map((point, idx) => (
              <div key={point.id} className="flex items-start gap-3 rounded-lg border border-white/8 p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 border border-emerald-500/30 text-xs font-bold text-emerald-400">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">{point.checkpoint.name}</p>
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(point.scanned_at, { timeStyle: 'short' })}
                    </div>
                  </div>
                  {point.checkpoint.description && <p className="text-xs text-zinc-500 mt-0.5">{point.checkpoint.description}</p>}
                  {point.notes && <p className="text-xs text-zinc-400 mt-1 italic">"{point.notes}"</p>}
                  {point.lat && (
                    <p className="flex items-center gap-1 text-xs text-zinc-600 mt-1">
                      <MapPin className="h-3 w-3" /> {point.lat.toFixed(4)}, {point.lng?.toFixed(4)}
                    </p>
                  )}
                </div>
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
