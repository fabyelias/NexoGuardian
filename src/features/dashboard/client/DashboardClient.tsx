import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, AlertTriangle, Route, BookOpen,
  CheckCircle2, ChevronRight, Shield, Clock,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { formatRelativeTime } from '@/shared/lib/utils'
import { INCIDENT_SEVERITY_LABELS } from '@/shared/types/enums'
import type { Site, Incident, PatrolSession, GuardLog } from '@/shared/types/models'

interface ClientData {
  sites: Site[]
  recentIncidents: Incident[]
  recentPatrols: PatrolSession[]
  recentLogs: GuardLog[]
}

export function DashboardClient() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState<ClientData>({ sites: [], recentIncidents: [], recentPatrols: [], recentLogs: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.organization_id) return
    load()
  }, [profile?.organization_id])

  async function load() {
    const orgId = profile!.organization_id
    const clientId = profile!.id
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // First get the client's sites
    const { data: sitesData } = await supabase
      .from('sites')
      .select('*')
      .eq('organization_id', orgId)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('name')

    const sites = (sitesData ?? []) as Site[]
    const siteIds = sites.map(s => s.id)

    if (siteIds.length === 0) {
      setData({ sites, recentIncidents: [], recentPatrols: [], recentLogs: [] })
      setLoading(false)
      return
    }

    const [incidentsRes, patrolsRes, logsRes] = await Promise.all([
      supabase.from('incidents')
        .select('*, site:sites(name), reporter:profiles!reported_by(first_name, last_name)')
        .eq('organization_id', orgId)
        .in('site_id', siteIds)
        .order('created_at', { ascending: false })
        .limit(8),

      supabase.from('patrol_sessions')
        .select('*, site:sites(name), guard:profiles!guard_id(first_name, last_name)')
        .eq('organization_id', orgId)
        .in('site_id', siteIds)
        .gte('started_at', sevenDaysAgo.toISOString())
        .order('started_at', { ascending: false })
        .limit(6),

      supabase.from('guard_logs')
        .select('*, guard:profiles!guard_id(first_name, last_name), site:sites(name)')
        .eq('organization_id', orgId)
        .in('site_id', siteIds)
        .order('recorded_at', { ascending: false })
        .limit(5),
    ])

    setData({
      sites,
      recentIncidents: (incidentsRes.data ?? []) as Incident[],
      recentPatrols: (patrolsRes.data ?? []) as PatrolSession[],
      recentLogs: (logsRes.data ?? []) as GuardLog[],
    })
    setLoading(false)
  }

  const { sites, recentIncidents, recentPatrols, recentLogs } = data
  const openIncidents = recentIncidents.filter(i => i.status === 'open' || i.status === 'in_progress')

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>
        <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
      </div>
    )
  }

  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
        <Building2 className="h-14 w-14 mb-4" />
        <p className="text-lg font-medium text-zinc-400">Sin objetivos asignados</p>
        <p className="text-sm text-zinc-600 mt-1 text-center max-w-xs">
          Todavía no hay objetivos asociados a tu perfil. Contactá a tu empresa de seguridad.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Bienvenido, {profile?.first_name}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Resumen de tus objetivos protegidos
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Building2 className="h-5 w-5 text-blue-400" />, value: sites.length, label: 'Objetivos', color: 'text-blue-400' },
          { icon: <AlertTriangle className="h-5 w-5 text-amber-400" />, value: openIncidents.length, label: 'Incidentes abiertos', color: openIncidents.length > 0 ? 'text-amber-400' : 'text-zinc-400' },
          { icon: <Route className="h-5 w-5 text-emerald-400" />, value: recentPatrols.length, label: 'Rondines (7 días)', color: 'text-emerald-400' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2.5">{s.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sites list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            Tus objetivos protegidos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {sites.map(site => (
              <div key={site.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-zinc-900/40 px-4 py-3">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{site.name}</p>
                  {site.address && <p className="text-xs text-zinc-500 truncate">{site.address}</p>}
                </div>
                {site.contact_name && (
                  <span className="text-xs text-zinc-600 hidden sm:block">{site.contact_name}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent incidents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Incidentes recientes
              </span>
              <button onClick={() => navigate('/incidents')} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Ver todos →
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentIncidents.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-zinc-600">
                <CheckCircle2 className="h-8 w-8 mb-2" />
                <p className="text-sm">Sin incidentes registrados</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentIncidents.map(inc => (
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
                        <p className="text-xs text-zinc-500">
                          {(inc.site as { name: string } | undefined)?.name} · {formatRelativeTime(inc.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant={
                        inc.status === 'resolved' || inc.status === 'closed' ? 'default' :
                        inc.severity === 'critical' ? 'panic' :
                        inc.severity === 'high' ? 'destructive' :
                        inc.severity === 'medium' ? 'warning' : 'default'
                      }>
                        {inc.status === 'resolved' ? 'Resuelto' : inc.status === 'closed' ? 'Cerrado' : INCIDENT_SEVERITY_LABELS[inc.severity]}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent patrols */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-4 w-4 text-emerald-400" />
              Rondines recientes (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentPatrols.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-zinc-600">
                <Clock className="h-8 w-8 mb-2" />
                <p className="text-sm">Sin rondines en los últimos 7 días</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentPatrols.map(patrol => {
                  const guard = patrol.guard as { first_name: string; last_name: string } | undefined
                  const site = patrol.site as { name: string } | undefined
                  const pct = patrol.total_checkpoints > 0
                    ? Math.round((patrol.visited_checkpoints / patrol.total_checkpoints) * 100)
                    : 0
                  return (
                    <div key={patrol.id} className="rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{site?.name ?? '—'}</p>
                          <p className="text-xs text-zinc-500">
                            {guard ? `${guard.first_name} ${guard.last_name}` : '—'}
                            {' · '}{formatRelativeTime(patrol.started_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className={`text-xs font-medium ${patrol.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {pct}%
                          </span>
                          <div className={`h-1.5 w-1.5 rounded-full ${patrol.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        </div>
                      </div>
                      <div className="mt-2 h-1 w-full rounded-full bg-white/5">
                        <div
                          className={`h-1 rounded-full ${patrol.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent logs */}
      {recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-zinc-400" />
              Últimas novedades en tus objetivos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {recentLogs.map(log => {
                const guard = log.guard as { first_name: string; last_name: string } | undefined
                const site = log.site as { name: string } | undefined
                return (
                  <div key={log.id} className="flex gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-600 shrink-0 mt-2" />
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
