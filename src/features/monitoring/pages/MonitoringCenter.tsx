import { useEffect, useState, useCallback } from 'react'
import {
  Radio, Users, AlertTriangle, Shield, Wifi, WifiOff,
  MapPin, CheckCircle2, Clock, Siren,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { formatRelativeTime, getInitials } from '@/shared/lib/utils'
import { LiveGuardMap } from '../components/LiveGuardMap'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import type { Incident, Profile, GuardLocation } from '@/shared/types/models'
import { INCIDENT_SEVERITY_LABELS, INCIDENT_CATEGORY_LABELS } from '@/shared/types/enums'

interface GuardStatus extends Profile {
  location?: GuardLocation
  isOnline: boolean
}

interface PanicStatus {
  incident: Incident
  notifications: { user_id: string; is_read: boolean; profile?: { first_name: string; last_name: string } }[]
  minutesElapsed: number
}

export function MonitoringCenter() {
  const { profile } = useAuthStore()
  const [guards, setGuards] = useState<GuardStatus[]>([])
  const [openIncidents, setOpenIncidents] = useState<Incident[]>([])
  const [panicStatuses, setPanicStatuses] = useState<PanicStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [now, setNow] = useState(Date.now())

  // Tick every minute to update elapsed times
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const loadData = useCallback(async () => {
    if (!profile?.organization_id) return
    const orgId = profile.organization_id
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const [guardsRes, incidentsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', orgId)
        .eq('role', 'guard')
        .eq('is_active', true),
      supabase
        .from('incidents')
        .select('*, site:sites(name), reporter:profiles!reported_by(first_name, last_name)')
        .eq('organization_id', orgId)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const guardProfiles = (guardsRes.data ?? []) as Profile[]

    const locationsRes = await supabase
      .from('guard_locations')
      .select('*')
      .in('guard_id', guardProfiles.map(g => g.id))
      .gte('recorded_at', fiveMinutesAgo)
      .order('recorded_at', { ascending: false })

    const locationMap = new Map<string, GuardLocation>()
    for (const loc of locationsRes.data ?? []) {
      if (!locationMap.has(loc.guard_id)) {
        locationMap.set(loc.guard_id, loc as GuardLocation)
      }
    }

    const guardStatuses: GuardStatus[] = guardProfiles.map(g => ({
      ...g,
      location: locationMap.get(g.id),
      isOnline: locationMap.has(g.id),
    }))

    setGuards(guardStatuses)

    const incidents = (incidentsRes.data ?? []) as Incident[]
    setOpenIncidents(incidents)

    // Load panic escalation status
    const panicIncidents = incidents.filter(i => i.is_panic)
    if (panicIncidents.length > 0) {
      const notifRes = await supabase
        .from('notifications')
        .select('user_id, is_read, profile:profiles(first_name, last_name)')
        .in('reference_id', panicIncidents.map(i => i.id))
        .eq('type', 'panic')

      const notifsByIncident = new Map<string, typeof notifRes.data>()
      for (const n of notifRes.data ?? []) {
        const incidentId = panicIncidents.find(i =>
          (notifRes.data ?? []).some(x => x.user_id === n.user_id)
        )?.id
        if (incidentId) {
          if (!notifsByIncident.has(incidentId)) notifsByIncident.set(incidentId, [])
          notifsByIncident.get(incidentId)!.push(n)
        }
      }

      // Better: query notifications per incident reference_id
      const panicNotifRes = await supabase
        .from('notifications')
        .select('reference_id, user_id, is_read')
        .in('reference_id', panicIncidents.map(i => i.id))
        .eq('type', 'panic')

      // Get profiles for all notified users
      const notifUserIds = [...new Set((panicNotifRes.data ?? []).map(n => n.user_id))]
      const profilesRes = notifUserIds.length > 0
        ? await supabase.from('profiles').select('id, first_name, last_name').in('id', notifUserIds)
        : { data: [] }

      const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]))

      const statuses: PanicStatus[] = panicIncidents.map(inc => {
        const notifs = (panicNotifRes.data ?? [])
          .filter(n => n.reference_id === inc.id)
          .map(n => ({ ...n, profile: profileMap.get(n.user_id) }))

        const minutesElapsed = Math.floor((Date.now() - new Date(inc.created_at).getTime()) / 60_000)

        return { incident: inc, notifications: notifs, minutesElapsed }
      })

      setPanicStatuses(statuses)
    } else {
      setPanicStatuses([])
    }

    setIsLoading(false)
  }, [profile?.organization_id])

  useEffect(() => {
    if (!profile?.organization_id) return
    loadData()

    const channel = supabase
      .channel(`monitoring-${profile.organization_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents', filter: `organization_id=eq.${profile.organization_id}` }, loadData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, loadData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guard_locations' }, loadData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.organization_id, loadData])

  // Recalculate elapsed time each tick
  useEffect(() => {
    setPanicStatuses(prev => prev.map(ps => ({
      ...ps,
      minutesElapsed: Math.floor((now - new Date(ps.incident.created_at).getTime()) / 60_000),
    })))
  }, [now])

  const onlineGuards = guards.filter(g => g.isOnline)
  const offlineGuards = guards.filter(g => !g.isOnline)
  const panicIncidents = openIncidents.filter(i => i.is_panic)

  // Build map pins: online guards, with panic flag if they triggered a panic
  const panicGuardIds = new Set(panicIncidents.map(i => i.reported_by))
  const mapPins = onlineGuards
    .filter(g => g.location)
    .map(g => ({
      guard: g,
      location: g.location!,
      isPanic: panicGuardIds.has(g.id),
    }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/20">
            <Radio className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Centro de Monitoreo</h2>
            <p className="text-xs text-zinc-500">Visualización operativa en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-zinc-400">En vivo</span>
        </div>
      </div>

      {/* ── PANIC ESCALATION ── */}
      {panicStatuses.length > 0 && (
        <div className="space-y-3">
          {panicStatuses.map(({ incident, notifications, minutesElapsed }) => {
            const anyResponded = notifications.some(n => n.is_read)
            const unrespondedCount = notifications.filter(n => !n.is_read).length
            const isEscalated = minutesElapsed >= 5 && !anyResponded

            return (
              <div
                key={incident.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  isEscalated
                    ? 'border-red-500 bg-red-950/40'
                    : 'border-red-600/50 bg-red-950/20'
                }`}
              >
                {/* Title row */}
                <div className="flex items-center gap-2">
                  <Siren className={`h-5 w-5 text-red-400 ${isEscalated ? 'animate-bounce' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-red-300">{incident.title}</p>
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Hace {minutesElapsed} min · {(incident.site as any)?.name ?? 'Sin objetivo'}
                    </p>
                  </div>
                  {(incident.lat && incident.lng) && (
                    <a
                      href={`https://www.google.com/maps?q=${incident.lat},${incident.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-md bg-red-600/30 hover:bg-red-600/50 px-2.5 py-1.5 text-xs text-red-300 transition-colors shrink-0"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Ver en mapa
                    </a>
                  )}
                </div>

                {/* Supervisor response tracker */}
                {notifications.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                      Respuesta de supervisores
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {notifications.map((n) => (
                        <div
                          key={n.user_id}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                            n.is_read
                              ? 'bg-emerald-950/40 border border-emerald-800/30'
                              : 'bg-zinc-900 border border-zinc-700/50'
                          }`}
                        >
                          {n.is_read ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full border-2 border-zinc-600 shrink-0 animate-pulse" />
                          )}
                          <span className={n.is_read ? 'text-emerald-400' : 'text-zinc-400'}>
                            {n.profile
                              ? `${n.profile.first_name} ${n.profile.last_name}`
                              : 'Supervisor'}
                          </span>
                          <span className={`ml-auto font-medium ${n.is_read ? 'text-emerald-500' : 'text-red-400'}`}>
                            {n.is_read ? 'Atendido' : 'Sin respuesta'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {isEscalated && unrespondedCount > 0 && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-900/50 border border-red-600/50 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                        <p className="text-xs text-red-300 font-semibold">
                          ⚠️ {unrespondedCount} supervisor{unrespondedCount > 1 ? 'es' : ''} sin responder después de {minutesElapsed} minutos
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── LIVE MAP ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-400" />
              Posiciones en tiempo real
            </span>
            <div className="flex items-center gap-3 text-xs font-normal">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {onlineGuards.length} en línea
              </span>
              {panicIncidents.length > 0 && (
                <span className="flex items-center gap-1.5 text-red-400">
                  <Siren className="h-3.5 w-3.5" />
                  {panicIncidents.length} pánico
                </span>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {mapPins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-600 rounded-xl border border-white/5 bg-white/2">
              <MapPin className="h-8 w-8 mb-2" />
              <p className="text-sm">Sin guardias con ubicación activa</p>
              <p className="text-xs text-zinc-700 mt-1">La ubicación se actualiza automáticamente durante el turno</p>
            </div>
          ) : (
            <ErrorBoundary>
              <LiveGuardMap pins={mapPins} height="340px" />
            </ErrorBoundary>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Guards status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                Personal
              </span>
              <div className="flex items-center gap-3 text-xs font-normal">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Wifi className="h-3 w-3" /> {onlineGuards.length} en línea
                </span>
                <span className="flex items-center gap-1 text-zinc-500">
                  <WifiOff className="h-3 w-3" /> {offlineGuards.length} offline
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {isLoading ? (
                [...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />)
              ) : guards.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">Sin personal registrado</p>
              ) : (
                guards.map(guard => (
                  <div
                    key={guard.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      panicGuardIds.has(guard.id)
                        ? 'border-red-600/50 bg-red-950/20'
                        : 'border-white/5 bg-white/2'
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getInitials(guard.first_name, guard.last_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {guard.first_name} {guard.last_name}
                        {panicGuardIds.has(guard.id) && (
                          <span className="ml-2 text-xs text-red-400">🚨 PÁNICO</span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        {guard.location ? (
                          <>
                            <MapPin className="h-3 w-3" />
                            {guard.location.lat.toFixed(4)}, {guard.location.lng.toFixed(4)}
                            {' · '}{formatRelativeTime(guard.location.recorded_at)}
                          </>
                        ) : 'Sin ubicación reciente'}
                      </p>
                    </div>
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${guard.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Open incidents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Incidentes Abiertos
              <span className="ml-auto text-xs font-normal text-zinc-500">{openIncidents.length} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {isLoading ? (
                [...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />)
              ) : openIncidents.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-zinc-600">
                  <Shield className="h-8 w-8 mb-2" />
                  <p className="text-sm">Sin incidentes abiertos</p>
                </div>
              ) : (
                openIncidents.map(incident => (
                  <div
                    key={incident.id}
                    className={`rounded-lg border p-3 ${
                      incident.is_panic ? 'border-red-600/50 bg-red-950/20' : 'border-white/5 bg-white/2'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{incident.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {(incident.site as { name: string } | undefined)?.name}
                          {' · '}{formatRelativeTime(incident.created_at)}
                        </p>
                      </div>
                      <Badge variant={
                        incident.is_panic ? 'panic' :
                        incident.severity === 'critical' || incident.severity === 'high' ? 'destructive' :
                        incident.severity === 'medium' ? 'warning' : 'default'
                      }>
                        {incident.is_panic ? '🚨 PÁNICO' : INCIDENT_SEVERITY_LABELS[incident.severity]}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{INCIDENT_CATEGORY_LABELS[incident.category]}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
