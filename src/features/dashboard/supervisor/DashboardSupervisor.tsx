import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, AlertTriangle, Building2, UserX,
  CheckCircle2, Clock, BookOpen, ChevronRight,
  Activity,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useSites } from '@/features/sites/hooks/useSites'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { getInitials, formatRelativeTime } from '@/shared/lib/utils'
import { INCIDENT_SEVERITY_LABELS } from '@/shared/types/enums'
import type { Shift, Incident, GuardLog, Profile, Site } from '@/shared/types/models'

type CoverageStatus = 'active' | 'scheduled' | 'overdue' | 'completed' | 'none'

const COVERAGE_CONFIG: Record<CoverageStatus, { label: string; dot: string; bg: string; border: string; text: string }> = {
  active:    { label: 'Activo',          dot: 'bg-emerald-400 animate-pulse', bg: 'bg-emerald-600/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  scheduled: { label: 'Programado',      dot: 'bg-blue-400',                  bg: 'bg-blue-600/10',    border: 'border-blue-500/20',    text: 'text-blue-400'    },
  overdue:   { label: 'Sin presentar',   dot: 'bg-red-500 animate-pulse',     bg: 'bg-red-600/10',     border: 'border-red-500/20',     text: 'text-red-400'     },
  completed: { label: 'Turno finalizado',dot: 'bg-zinc-600',                  bg: 'bg-zinc-800/40',    border: 'border-white/5',        text: 'text-zinc-500'    },
  none:      { label: 'Sin cobertura',   dot: 'bg-zinc-700',                  bg: 'bg-transparent',    border: 'border-white/5',        text: 'text-zinc-600'    },
}

interface DashData {
  todayShifts: Shift[]
  openIncidents: Incident[]
  recentLogs: GuardLog[]
}

function getSiteCoverage(siteId: string, shifts: Shift[]): { status: CoverageStatus; guard?: Profile } {
  const now = new Date()
  const siteShifts = shifts.filter(s => s.site_id === siteId)
  if (siteShifts.length === 0) return { status: 'none' }

  const active = siteShifts.find(s => s.status === 'active')
  if (active) return { status: 'active', guard: active.guard as Profile }

  const overdue = siteShifts.find(s => s.status === 'scheduled' && new Date(s.scheduled_start) <= now)
  if (overdue) return { status: 'overdue', guard: overdue.guard as Profile }

  const scheduled = siteShifts.find(s => s.status === 'scheduled' && new Date(s.scheduled_start) > now)
  if (scheduled) return { status: 'scheduled', guard: scheduled.guard as Profile }

  if (siteShifts.some(s => s.status === 'completed')) return { status: 'completed' }
  return { status: 'none' }
}

export function DashboardSupervisor() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const { data: sites = [] } = useSites()
  const [data, setData] = useState<DashData>({ todayShifts: [], openIncidents: [], recentLogs: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.organization_id) return
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [profile?.organization_id])

  async function load() {
    const orgId = profile!.organization_id
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const [shiftsRes, incidentsRes, logsRes] = await Promise.all([
      supabase.from('shifts')
        .select('*, guard:profiles!guard_id(id, first_name, last_name, badge_number, avatar_url), site:sites(id, name)')
        .eq('organization_id', orgId)
        .gte('scheduled_start', today.toISOString())
        .lt('scheduled_start', tomorrow.toISOString())
        .order('scheduled_start'),

      supabase.from('incidents')
        .select('*, site:sites(name), reporter:profiles!reported_by(first_name, last_name)')
        .eq('organization_id', orgId)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(6),

      supabase.from('guard_logs')
        .select('*, guard:profiles!guard_id(first_name, last_name), site:sites(name)')
        .eq('organization_id', orgId)
        .order('recorded_at', { ascending: false })
        .limit(5),
    ])

    setData({
      todayShifts: (shiftsRes.data ?? []) as Shift[],
      openIncidents: (incidentsRes.data ?? []) as Incident[],
      recentLogs: (logsRes.data ?? []) as GuardLog[],
    })
    setLoading(false)
  }

  const { todayShifts, openIncidents, recentLogs } = data
  const activeGuards = todayShifts.filter(s => s.status === 'active')
  const overdueShifts = todayShifts.filter(s => s.status === 'scheduled' && new Date(s.scheduled_start) <= new Date())
  const coveredSites = sites.filter(s => getSiteCoverage(s.id, todayShifts).status === 'active').length

  const stats = [
    { label: 'Guardias activos',    value: activeGuards.length,     color: 'text-emerald-400', icon: <Shield className="h-5 w-5 text-emerald-400" /> },
    { label: 'Objetivos cubiertos', value: coveredSites,             color: 'text-blue-400',    icon: <Building2 className="h-5 w-5 text-blue-400" /> },
    { label: 'Incidentes abiertos', value: openIncidents.length,     color: 'text-amber-400',   icon: <AlertTriangle className="h-5 w-5 text-amber-400" /> },
    { label: 'Sin presentarse',     value: overdueShifts.length,     color: overdueShifts.length > 0 ? 'text-red-400' : 'text-zinc-400', icon: <UserX className="h-5 w-5 text-red-400" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Bienvenido, {profile?.first_name}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.color}`}>{loading ? '—' : s.value}</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2.5">{s.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coverage grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            Cobertura de objetivos — hoy
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />)}</div>
          ) : sites.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No hay objetivos registrados</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sites.map(site => {
                const { status, guard } = getSiteCoverage(site.id, todayShifts)
                const cfg = COVERAGE_CONFIG[status]
                return (
                  <div key={site.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${cfg.bg} ${cfg.border}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                      <span className="text-sm text-zinc-300 truncate font-medium">{site.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {guard && (
                        <span className="text-xs text-zinc-400 hidden sm:block">
                          {guard.first_name[0]}. {guard.last_name}
                        </span>
                      )}
                      <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Active guards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              Guardias en turno ahora
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />)}</div>
            ) : activeGuards.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-zinc-600">
                <Clock className="h-8 w-8 mb-2" />
                <p className="text-sm">Sin guardias activos ahora</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeGuards.map(shift => {
                  const guard = shift.guard as Profile | undefined
                  const site = shift.site as Site | undefined
                  return (
                    <div key={shift.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2.5">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={(guard as any)?.avatar_url} />
                        <AvatarFallback className="text-[10px]">
                          {guard ? getInitials(guard.first_name, guard.last_name) : 'GD'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {guard ? `${guard.first_name} ${guard.last_name}` : 'Vigilador'}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">{site?.name ?? '—'}</p>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open incidents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Incidentes abiertos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />)}</div>
            ) : openIncidents.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-zinc-600">
                <CheckCircle2 className="h-8 w-8 mb-2" />
                <p className="text-sm">Sin incidentes abiertos</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {openIncidents.map(inc => (
                  <button
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className="flex w-full items-center justify-between py-3 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${
                        inc.severity === 'critical' ? 'bg-red-500 animate-pulse' :
                        inc.severity === 'high' ? 'bg-orange-500' :
                        inc.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                      <div className="min-w-0 text-left">
                        <p className="text-sm text-white font-medium truncate">{inc.title}</p>
                        <p className="text-xs text-zinc-500">{(inc.site as { name: string } | undefined)?.name} · {formatRelativeTime(inc.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant={inc.severity === 'critical' ? 'panic' : inc.severity === 'high' ? 'destructive' : inc.severity === 'medium' ? 'warning' : 'default'}>
                        {INCIDENT_SEVERITY_LABELS[inc.severity]}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-zinc-400" />
              Últimas novedades
            </span>
            <button onClick={() => navigate('/guard-log')} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Ver todas →
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {recentLogs.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">Sin novedades recientes</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map(log => {
                const guard = log.guard as { first_name: string; last_name: string } | undefined
                const site = log.site as { name: string } | undefined
                return (
                  <div key={log.id} className="flex gap-3">
                    <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-zinc-600 shrink-0 mt-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 leading-relaxed line-clamp-2">
                        {log.ai_enhanced || log.content}
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {guard ? `${guard.first_name} ${guard.last_name}` : '—'}
                        {site ? ` · ${site.name}` : ''}
                        {' · '}{formatRelativeTime(log.recorded_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
