import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Plus, Search, Filter, Siren } from 'lucide-react'
import { useIncidents } from '../hooks/useIncidents'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { formatRelativeTime } from '@/shared/lib/utils'
import {
  INCIDENT_CATEGORY_LABELS, INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS,
} from '@/shared/types/enums'
import type { IncidentStatus, IncidentSeverity } from '@/shared/types/enums'

const STATUS_FILTERS: { value: IncidentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'resolved', label: 'Resueltos' },
  { value: 'closed', label: 'Cerrados' },
]

const SEVERITY_BADGE: Record<IncidentSeverity, 'default' | 'warning' | 'destructive' | 'panic'> = {
  low: 'default', medium: 'warning', high: 'destructive', critical: 'panic',
}

export function IncidentsPage() {
  const navigate = useNavigate()
  const { data: incidents = [], isLoading } = useIncidents()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all')

  const filtered = incidents.filter((i) => {
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter
    const matchesSearch =
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const openCount = incidents.filter(i => i.status === 'open').length
  const panicCount = incidents.filter(i => i.is_panic && i.status === 'open').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Incidentes</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {openCount} abierto{openCount !== 1 ? 's' : ''}
            {panicCount > 0 && <span className="ml-2 text-red-400 font-medium">· {panicCount} PÁNICO</span>}
          </p>
        </div>
        <Button onClick={() => navigate('/incidents/new')}>
          <Plus className="h-4 w-4" /> Nuevo incidente
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input placeholder="Buscar incidentes..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <AlertTriangle className="h-12 w-12 mb-3" />
          <p className="text-base font-medium text-zinc-400">Sin incidentes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((incident) => (
            <button
              key={incident.id}
              onClick={() => navigate(`/incidents/${incident.id}`)}
              className={`w-full text-left rounded-xl border p-4 transition-colors hover:border-white/15 hover:bg-white/2 ${
                incident.is_panic ? 'border-red-600/40 bg-red-950/10' : 'border-white/8'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    incident.is_panic ? 'bg-red-600/20' : 'bg-white/5'
                  }`}>
                    {incident.is_panic
                      ? <Siren className="h-4 w-4 text-red-400" />
                      : <AlertTriangle className="h-4 w-4 text-amber-400" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{incident.title}</p>
                    <p className="text-sm text-zinc-500 mt-0.5 line-clamp-1">{incident.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
                      <span>{(incident.site as { name: string } | undefined)?.name ?? '—'}</span>
                      <span>·</span>
                      <span>{INCIDENT_CATEGORY_LABELS[incident.category]}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(incident.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge variant={SEVERITY_BADGE[incident.severity]}>
                    {incident.is_panic ? '🚨 PÁNICO' : INCIDENT_SEVERITY_LABELS[incident.severity]}
                  </Badge>
                  <Badge variant="outline">{INCIDENT_STATUS_LABELS[incident.status]}</Badge>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
