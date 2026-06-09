import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, AlertTriangle, Route, Siren,
  ChevronRight, MapPin, Wifi, WifiOff,
  Activity,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { LiveGuardMap } from '@/features/monitoring/components/LiveGuardMap'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { formatRelativeTime } from '@/shared/lib/utils'
import { INCIDENT_SEVERITY_LABELS } from '@/shared/types/enums'
import type { Incident, Profile, GuardLocation, PatrolSession, Site } from '@/shared/types/models'

interface GuardOnline extends Profile {
  location?: GuardLocation
  isOnline: boolean
  siteName?: string
}

interface PatrolProgress extends PatrolSession {
  guardName: string
  siteName: string
  pct: number
}

interface DashData {
  activeShifts: number
  openIncidents: number
  panicCount: number
  completedPatrolsToday: number
  recentIncidents: Incident[]
  guardsOnline: GuardOnline[]
  activePatrols: PatrolProgress[]
}

const EMPTY: DashData = {
  activeShifts: 0, openIncidents: 0, panicCount: 0,
  completedPatrolsToday: 0, recentIncidents: [],
  guardsOnline: [], activePatrols: [],
}

const SEV_DOT: Record<string, string> = {
  critical: 'bg-red-500 animate-pulse',
  high:     'bg-orange-400',
  medium:   'bg-amber-400',
  low:      'bg-blue-400',
}

export function DashboardAdmin() {
  const { profile } = useAuthStore()
  const navigate    = useNavigate()
  const [data, setData]       = useState<DashData>(EMPTY)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile?.organization_id) return
    const orgId = profile.organization_id
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()

    const [
      shiftsRes, incCountRes, panicRes, patrolTodayRes,
      incidentsRes, guardsRes, patrolsRes,
    ] = await Promise.all([
      supabase.from('shifts').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('status', 'active'),
      supabase.from('incidents').select('id', { count: 'exact' }).eq('organization_id', orgId).in('status', ['open', 'in_progress']),
      supabase.from('incidents').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('is_panic', true).in('status', ['open', 'in_progress']),
      supabase.from('patrol_sessions').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('status', 'completed').gte('started_at', todayStart.toISOString()),
      supabase.from('incidents').select('*, site:sites(name)').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(6),
      supabase.from('profiles').select('*').eq('organization_id', orgId).eq('role', 'guard').eq('is_active', true),
      supabase.from('patrol_sessions')
        .select('*, guard:profiles!guard_id(first_name, last_name), site:sites(name)')
        .eq('organization_id', orgId).in('status', ['active'])
        .order('started_at', { ascending: false }).limit(5),
    ])

    const guards = (guardsRes.data ?? []) as Profile[]

    // Latest locations per guard (last 5 min = online)
    const locRes = guards.length
      ? await supabase.from('guard_locations').select('*')
          .in('guard_id', guards.map(g => g.id))
          .gte('recorded_at', fiveMinAgo)
          .order('recorded_at', { ascending: false })
      : { data: [] }

    const locMap = new Map<string, GuardLocation>()
    for (const loc of locRes.data ?? []) {
      if (!locMap.has(loc.guard_id)) locMap.set(loc.guard_id, loc as GuardLocation)
    }

    // Active shifts → site names per guard
    const shiftRes = await supabase.from('shifts')
      .select('guard_id, site:sites(name)').eq('organization_id', orgId).eq('status', 'active')
    const shiftSiteMap = new Map<string, string>()
    for (const s of shiftRes.data ?? []) {
      shiftSiteMap.set(s.guard_id, (s.site as unknown as { name: string } | null)?.name ?? '—')
    }

    const guardsOnline: GuardOnline[] = guards.map(g => ({
      ...g,
      location: locMap.get(g.id),
      isOnline: locMap.has(g.id),
      siteName: shiftSiteMap.get(g.id),
    })).sort((a, b) => Number(b.isOnline) - Number(a.isOnline))

    const activePatrols: PatrolProgress[] = (patrolsRes.data ?? []).map((p: any) => ({
      ...p,
      guardName: p.guard ? `${p.guard.first_name} ${p.guard.last_name}` : '—',
      siteName: (p.site as Site | null)?.name ?? '—',
      pct: p.total_checkpoints > 0
        ? Math.round((p.visited_checkpoints / p.total_checkpoints) * 100)
        : 0,
    }))

    setData({
      activeShifts:          shiftsRes.count ?? 0,
      openIncidents:         incCountRes.count ?? 0,
      panicCount:            panicRes.count ?? 0,
      completedPatrolsToday: patrolTodayRes.count ?? 0,
      recentIncidents:       (incidentsRes.data ?? []) as Incident[],
      guardsOnline,
      activePatrols,
    })
    setLoading(false)
  }, [profile?.organization_id])

  useEffect(() => {
    load()
    const iv = setInterval(load, 30_000)
    return () => clearInterval(iv)
  }, [load])

  const onlineCount  = data.guardsOnline.filter(g => g.isOnline).length
  const offlineCount = data.guardsOnline.length - onlineCount

  const mapPins = data.guardsOnline
    .filter(g => g.location)
    .map(g => ({ guard: g, location: g.location!, isPanic: false }))

  // ── STAT CARDS ─────────────────────────────────────────────
  const stats = [
    {
      label: 'Guardias en turno',
      value: data.activeShifts,
      icon: <Shield className="h-5 w-5" />,
      accent: 'text-blue-400',
      iconBg: 'bg-blue-500/10 border-blue-500/20',
      glow: false,
    },
    {
      label: 'Incidentes abiertos',
      value: data.openIncidents,
      icon: <AlertTriangle className="h-5 w-5" />,
      accent: data.openIncidents > 0 ? 'text-amber-400' : 'text-zinc-500',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
      glow: false,
    },
    {
      label: 'Rondines completados',
      value: data.completedPatrolsToday,
      icon: <Route className="h-5 w-5" />,
      accent: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      glow: false,
    },
    {
      label: 'Alertas de pánico',
      value: data.panicCount,
      icon: <Siren className="h-5 w-5" />,
      accent: data.panicCount > 0 ? 'text-red-400' : 'text-zinc-500',
      iconBg: data.panicCount > 0 ? 'bg-red-500/15 border-red-500/40' : 'bg-white/5 border-white/8',
      glow: data.panicCount > 0,
    },
  ]

  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Bienvenido, {profile?.first_name}
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-800/40 bg-emerald-950/30 px-3 py-1.5">
          <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">En vivo</span>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`relative overflow-hidden rounded-2xl border bg-zinc-900/60 p-5 backdrop-blur-sm ${
              s.glow ? 'border-red-500/50 shadow-lg shadow-red-950/40' : 'border-white/8'
            }`}
          >
            {s.glow && (
              <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 to-transparent pointer-events-none" />
            )}
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs text-zinc-500 leading-none">{s.label}</p>
                <p className={`text-4xl font-black mt-2 tracking-tight ${s.accent} ${s.glow ? 'animate-pulse' : ''}`}>
                  {loading ? '—' : s.value}
                </p>
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${s.iconBg} ${s.accent}`}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── MAP + INCIDENTS ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

        {/* Live map — 3/5 */}
        <div className="lg:col-span-3 rounded-2xl border border-white/8 bg-zinc-900/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Mapa en vivo</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Wifi className="h-3 w-3" /> {onlineCount} en línea
              </span>
              {offlineCount > 0 && (
                <span className="flex items-center gap-1.5 text-zinc-600">
                  <WifiOff className="h-3 w-3" /> {offlineCount} offline
                </span>
              )}
            </div>
          </div>
          {mapPins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-700">
              <MapPin className="h-8 w-8 mb-2" />
              <p className="text-sm">Sin guardias con ubicación activa</p>
              <p className="text-xs text-zinc-800 mt-1">Los vigiladores deben tener turno activo</p>
            </div>
          ) : (
            <ErrorBoundary>
              <LiveGuardMap pins={mapPins} height="300px" />
            </ErrorBoundary>
          )}
        </div>

        {/* Recent incidents — 2/5 */}
        <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-zinc-900/60 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Incidentes recientes</span>
            </div>
            <button
              onClick={() => navigate('/incidents')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors"
            >
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 px-1">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />)}
              </div>
            ) : data.recentIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-700">
                <Shield className="h-8 w-8 mb-2" />
                <p className="text-sm">Sin incidentes recientes</p>
              </div>
            ) : (
              data.recentIncidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => navigate(`/incidents/${inc.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
                >
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEV_DOT[inc.severity] ?? 'bg-zinc-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate leading-tight">{inc.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      {(inc.site as { name: string } | undefined)?.name ?? '—'}
                      {' · '}{formatRelativeTime(inc.created_at)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    inc.is_panic ? 'text-red-400 border-red-600/40 bg-red-950/30' :
                    inc.severity === 'critical' || inc.severity === 'high' ? 'text-orange-400 border-orange-600/30 bg-orange-950/20' :
                    inc.severity === 'medium' ? 'text-amber-400 border-amber-600/30 bg-amber-950/20' :
                    'text-zinc-400 border-zinc-700/50 bg-zinc-800/30'
                  }`}>
                    {inc.is_panic ? 'PÁNICO' : INCIDENT_SEVERITY_LABELS[inc.severity]}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── PATROLS + ONLINE GUARDS ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Active patrols */}
        <div className="rounded-2xl border border-white/8 bg-zinc-900/60">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <Route className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Rondines en curso</span>
            </div>
            <button
              onClick={() => navigate('/patrols')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors"
            >
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />)
            ) : data.activePatrols.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-zinc-700">
                <Route className="h-8 w-8 mb-2" />
                <p className="text-sm">Sin rondines activos</p>
              </div>
            ) : (
              data.activePatrols.map((patrol) => (
                <div key={patrol.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-white font-medium truncate">{patrol.guardName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-500 truncate hidden sm:block">{patrol.siteName}</span>
                      <span className="text-xs font-bold text-emerald-400">{patrol.pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                      style={{ width: `${patrol.pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-600">
                    {patrol.visited_checkpoints} / {patrol.total_checkpoints} checkpoints
                    {' · '}{patrol.siteName}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Online guards */}
        <div className="rounded-2xl border border-white/8 bg-zinc-900/60">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Guardias en línea</span>
            </div>
            <button
              onClick={() => navigate('/monitoring')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors"
            >
              Monitoreo <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />)}
              </div>
            ) : data.guardsOnline.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-zinc-700">
                <Shield className="h-8 w-8 mb-2" />
                <p className="text-sm">Sin guardias registrados</p>
              </div>
            ) : (
              data.guardsOnline.map((guard) => (
                <div key={guard.id} className="flex items-center gap-3 px-5 py-3">
                  {/* Avatar initials */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-[11px] font-bold text-white">
                    {guard.first_name[0]}{guard.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {guard.first_name} {guard.last_name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {guard.siteName ?? (guard.isOnline ? 'Sin objetivo asignado' : 'Fuera de servicio')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`h-2 w-2 rounded-full ${guard.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
                    <span className={`text-xs font-medium ${guard.isOnline ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {guard.isOnline ? 'En línea' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
