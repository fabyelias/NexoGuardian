import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, AlertTriangle, MapPin, Clock, User, Siren,
  CheckCircle2, Loader2, Send, Building2,
} from 'lucide-react'
import { useIncident, useIncidentUpdates, useUpdateIncidentStatus, useAddIncidentUpdate } from '../hooks/useIncidents'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Textarea } from '@/shared/components/ui/textarea'
import { formatDate, formatRelativeTime, getInitials } from '@/shared/lib/utils'
import {
  INCIDENT_CATEGORY_LABELS, INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS,
} from '@/shared/types/enums'
import type { IncidentStatus } from '@/shared/types/enums'

const NEXT_STATUSES: Record<IncidentStatus, { value: IncidentStatus; label: string }[]> = {
  open: [{ value: 'in_progress', label: 'Tomar caso' }, { value: 'closed', label: 'Cerrar' }],
  in_progress: [{ value: 'resolved', label: 'Marcar resuelto' }, { value: 'closed', label: 'Cerrar' }],
  resolved: [{ value: 'closed', label: 'Cerrar definitivamente' }],
  closed: [],
}

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: incident, isLoading } = useIncident(id!)
  const { data: updates = [] } = useIncidentUpdates(id!)
  const updateStatus = useUpdateIncidentStatus()
  const addUpdate = useAddIncidentUpdate()
  const [note, setNote] = useState('')

  async function handleStatusChange(status: IncidentStatus) {
    await updateStatus.mutateAsync({ id: id!, status })
  }

  async function handleAddNote() {
    if (!note.trim()) return
    await addUpdate.mutateAsync({ incidentId: id!, content: note })
    setNote('')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!incident) return null

  const reporter = incident.reporter as { first_name: string; last_name: string; badge_number?: string } | undefined
  const nextStatuses = NEXT_STATUSES[incident.status]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/incidents')} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Volver a incidentes
      </button>

      {/* Header card */}
      <div className={`rounded-xl border p-5 space-y-4 ${incident.is_panic ? 'border-red-600/40 bg-red-950/10' : 'border-white/8 bg-zinc-900/60'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${incident.is_panic ? 'bg-red-600/20' : 'bg-amber-600/10'}`}>
              {incident.is_panic ? <Siren className="h-5 w-5 text-red-400" /> : <AlertTriangle className="h-5 w-5 text-amber-400" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{incident.title}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={incident.is_panic ? 'panic' : incident.severity === 'critical' ? 'destructive' : incident.severity === 'high' ? 'destructive' : incident.severity === 'medium' ? 'warning' : 'default'}>
                  {incident.is_panic ? '🚨 PÁNICO' : INCIDENT_SEVERITY_LABELS[incident.severity]}
                </Badge>
                <Badge variant="outline">{INCIDENT_STATUS_LABELS[incident.status]}</Badge>
                <Badge variant="secondary">{INCIDENT_CATEGORY_LABELS[incident.category]}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <Building2 className="h-4 w-4 text-zinc-600" />
            {(incident.site as { name: string } | undefined)?.name ?? '—'}
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="h-4 w-4 text-zinc-600" />
            {formatDate(incident.created_at)}
          </div>
          {reporter && (
            <div className="flex items-center gap-2 text-zinc-400">
              <User className="h-4 w-4 text-zinc-600" />
              {reporter.first_name} {reporter.last_name}
              {reporter.badge_number && <span className="text-zinc-600">· #{reporter.badge_number}</span>}
            </div>
          )}
          {incident.lat && incident.lng && (
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin className="h-4 w-4 text-zinc-600" />
              {incident.lat.toFixed(5)}, {incident.lng.toFixed(5)}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Descripción</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{incident.description}</p>
          {incident.ai_description && incident.ai_description !== incident.description && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-3 mt-2">
              <p className="text-xs text-blue-400 mb-1 font-medium">✨ Descripción profesional (IA)</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{incident.ai_description}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {nextStatuses.length > 0 && (
          <div className="flex gap-2 pt-2 border-t border-white/8">
            {nextStatuses.map((s) => (
              <Button
                key={s.value}
                size="sm"
                variant={s.value === 'resolved' || s.value === 'closed' ? 'secondary' : 'default'}
                onClick={() => handleStatusChange(s.value)}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {s.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Historial</h3>
        <div className="space-y-3">
          {/* Original entry */}
          <div className="flex gap-3">
            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
              <AvatarFallback className="text-[10px]">
                {reporter ? getInitials(reporter.first_name, reporter.last_name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 rounded-lg border border-white/8 bg-zinc-900/60 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-zinc-300">
                  {reporter ? `${reporter.first_name} ${reporter.last_name}` : 'Sistema'} — Incidente creado
                </span>
                <span className="text-xs text-zinc-600">{formatRelativeTime(incident.created_at)}</span>
              </div>
              <p className="text-sm text-zinc-400">{incident.description}</p>
            </div>
          </div>

          {/* Updates */}
          {updates.map((update) => {
            const author = update.author as { first_name: string; last_name: string } | undefined
            return (
              <div key={update.id} className="flex gap-3">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarFallback className="text-[10px]">
                    {author ? getInitials(author.first_name, author.last_name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-lg border border-white/8 bg-zinc-900/60 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-zinc-300">
                      {author ? `${author.first_name} ${author.last_name}` : 'Sistema'}
                      {update.status_change && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          → {INCIDENT_STATUS_LABELS[update.status_change]}
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-zinc-600">{formatRelativeTime(update.created_at)}</span>
                  </div>
                  <p className="text-sm text-zinc-400">{update.content}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add note */}
        {incident.status !== 'closed' && (
          <div className="flex gap-3">
            <div className="h-7 w-7 shrink-0 rounded-full bg-blue-600/20 border border-blue-500/20 flex items-center justify-center mt-0.5">
              <Send className="h-3 w-3 text-blue-400" />
            </div>
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="Agregar nota o novedad al incidente..."
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button size="sm" onClick={handleAddNote} disabled={!note.trim() || addUpdate.isPending}>
                {addUpdate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Agregar nota
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
