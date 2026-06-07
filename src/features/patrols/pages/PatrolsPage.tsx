import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Route, CheckCircle2, Clock, AlertCircle, QrCode, Building2 } from 'lucide-react'
import { usePatrols } from '../hooks/usePatrols'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { formatDate, formatRelativeTime } from '@/shared/lib/utils'
import type { PatrolStatus } from '@/shared/types/enums'

const STATUS_CONFIG: Record<PatrolStatus, { label: string; icon: React.ReactNode; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  in_progress: { label: 'En curso', icon: <Clock className="h-3 w-3" />, variant: 'warning' },
  completed: { label: 'Completado', icon: <CheckCircle2 className="h-3 w-3" />, variant: 'success' },
  incomplete: { label: 'Incompleto', icon: <AlertCircle className="h-3 w-3" />, variant: 'destructive' },
}

export function PatrolsPage() {
  const navigate = useNavigate()
  const { data: patrols = [], isLoading } = usePatrols()
  const [filter, setFilter] = useState<PatrolStatus | 'all'>('all')

  const filtered = filter === 'all' ? patrols : patrols.filter(p => p.status === filter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Rondines</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{patrols.length} sesión{patrols.length !== 1 ? 'es' : ''} registrada{patrols.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => navigate('/patrols/new')}>
          <QrCode className="h-4 w-4" /> Iniciar rondín
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(['all', 'in_progress', 'completed', 'incomplete'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            {f === 'all' ? 'Todos' : STATUS_CONFIG[f].label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-zinc-600">
          <Route className="h-12 w-12 mb-3" />
          <p className="text-base font-medium text-zinc-400">Sin rondines registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((patrol) => {
            const statusConf = STATUS_CONFIG[patrol.status]
            const progress = patrol.total_checkpoints > 0
              ? Math.round((patrol.visited_checkpoints / patrol.total_checkpoints) * 100)
              : 0
            const guard = patrol.guard as { first_name: string; last_name: string } | undefined
            const site = patrol.site as { name: string } | undefined

            return (
              <button
                key={patrol.id}
                onClick={() => navigate(`/patrols/${patrol.id}`)}
                className="w-full text-left rounded-xl border border-white/8 p-4 hover:border-white/15 hover:bg-white/2 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/20">
                      <Route className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">
                          {site?.name ?? 'Sin sitio'}
                        </p>
                        <Badge variant={statusConf.variant} className="flex items-center gap-1">
                          {statusConf.icon}{statusConf.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {guard ? `${guard.first_name} ${guard.last_name}` : '—'} · {formatRelativeTime(patrol.started_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">{patrol.visited_checkpoints}/{patrol.total_checkpoints}</p>
                    <p className="text-xs text-zinc-500">puntos</p>
                    <div className="mt-1 h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
