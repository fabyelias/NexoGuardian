import { useEffect, useState } from 'react'
import { Radio, Users, AlertTriangle, Shield, Wifi, WifiOff, MapPin } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { formatRelativeTime, getInitials } from '@/shared/lib/utils'
import type { Incident, Profile, GuardLocation } from '@/shared/types/models'
import { INCIDENT_SEVERITY_LABELS, INCIDENT_CATEGORY_LABELS } from '@/shared/types/enums'

interface GuardStatus extends Profile {
  location?: GuardLocation
  isOnline: boolean
}

export function MonitoringCenter() {
  const { profile } = useAuthStore()
  const [guards, setGuards] = useState<GuardStatus[]>([])
  const [openIncidents, setOpenIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!profile?.organization_id) return
    loadData()
    setupRealtime()
  }, [profile?.organization_id])

  async function loadData() {
    const orgId = profile!.organization_id
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

    setGuards(guardProfiles.map(g => ({
      ...g,
      location: locationMap.get(g.id),
      isOnline: locationMap.has(g.id),
    })))

    setOpenIncidents((incidentsRes.data ?? []) as Incident[])
    setIsLoading(false)
  }

  function setupRealtime() {
    const channel = supabase
      .channel('monitoring')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'incidents',
        filter: `organization_id=eq.${profile!.organization_id}`,
      }, () => loadData())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'guard_locations',
      }, () => loadData())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  const onlineGuards = guards.filter(g => g.isOnline)
  const offlineGuards = guards.filter(g => !g.isOnline)
  const panicIncidents = openIncidents.filter(i => i.is_panic)

  return (
    <div className="space-y-6">
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

      {/* Panic alerts */}
      {panicIncidents.length > 0 && (
        <div className="rounded-xl border border-red-600/50 bg-red-950/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold">
            <AlertTriangle className="h-5 w-5" />
            {panicIncidents.length} ALERTA{panicIncidents.length > 1 ? 'S' : ''} DE PÁNICO ACTIVA{panicIncidents.length > 1 ? 'S' : ''}
          </div>
          {panicIncidents.map(incident => (
            <div key={incident.id} className="flex items-center justify-between bg-red-950/40 rounded-lg px-3 py-2">
              <span className="text-sm text-red-300">{incident.title}</span>
              <span className="text-xs text-red-500">{formatRelativeTime(incident.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                [...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
                ))
              ) : guards.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">Sin personal registrado</p>
              ) : (
                guards.map(guard => (
                  <div
                    key={guard.id}
                    className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/2 p-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getInitials(guard.first_name, guard.last_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {guard.first_name} {guard.last_name}
                      </p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        {guard.location ? (
                          <>
                            <MapPin className="h-3 w-3" />
                            {formatRelativeTime(guard.location.recorded_at)}
                          </>
                        ) : 'Sin ubicación reciente'}
                      </p>
                    </div>
                    <div className={`h-2 w-2 rounded-full ${guard.isOnline ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
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
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
                ))
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
                      incident.is_panic
                        ? 'border-red-600/50 bg-red-950/20'
                        : 'border-white/5 bg-white/2'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{incident.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {(incident.site as { name: string } | undefined)?.name} · {formatRelativeTime(incident.created_at)}
                        </p>
                      </div>
                      <Badge variant={
                        incident.is_panic ? 'panic' :
                        incident.severity === 'critical' ? 'destructive' :
                        incident.severity === 'high' ? 'destructive' :
                        incident.severity === 'medium' ? 'warning' : 'default'
                      }>
                        {incident.is_panic ? '🚨 PÁNICO' : INCIDENT_SEVERITY_LABELS[incident.severity]}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {INCIDENT_CATEGORY_LABELS[incident.category]}
                    </p>
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
