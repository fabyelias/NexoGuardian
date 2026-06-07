import { useEffect, useState } from 'react'
import {
  Users,
  AlertTriangle,
  Building2,
  Shield,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { formatRelativeTime } from '@/shared/lib/utils'
import type { Incident } from '@/shared/types/models'
import { INCIDENT_SEVERITY_LABELS } from '@/shared/types/enums'

interface Stats {
  totalGuards: number
  activeShifts: number
  openIncidents: number
  totalSites: number
}

export function DashboardAdmin() {
  const { profile } = useAuthStore()
  const [stats, setStats] = useState<Stats>({ totalGuards: 0, activeShifts: 0, openIncidents: 0, totalSites: 0 })
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!profile?.organization_id) return
    loadDashboardData()
  }, [profile?.organization_id])

  async function loadDashboardData() {
    const orgId = profile!.organization_id

    const [guardsRes, shiftsRes, incidentsRes, sitesRes, recentRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('role', 'guard').eq('is_active', true),
      supabase.from('shifts').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('status', 'active'),
      supabase.from('incidents').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('status', 'open'),
      supabase.from('sites').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('is_active', true),
      supabase.from('incidents').select('*, site:sites(name), reporter:profiles!reported_by(first_name, last_name)').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(5),
    ])

    setStats({
      totalGuards: guardsRes.count ?? 0,
      activeShifts: shiftsRes.count ?? 0,
      openIncidents: incidentsRes.count ?? 0,
      totalSites: sitesRes.count ?? 0,
    })

    setRecentIncidents((recentRes.data ?? []) as Incident[])
    setIsLoading(false)
  }

  const statCards = [
    { label: 'Vigiladores Activos', value: stats.totalGuards, icon: <Shield className="h-5 w-5 text-blue-400" />, color: 'text-blue-400' },
    { label: 'Turnos en Curso', value: stats.activeShifts, icon: <Activity className="h-5 w-5 text-emerald-400" />, color: 'text-emerald-400' },
    { label: 'Incidentes Abiertos', value: stats.openIncidents, icon: <AlertTriangle className="h-5 w-5 text-amber-400" />, color: 'text-amber-400' },
    { label: 'Objetivos Activos', value: stats.totalSites, icon: <Building2 className="h-5 w-5 text-violet-400" />, color: 'text-violet-400' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Bienvenido, {profile?.first_name}
        </h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Resumen operativo del {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">{card.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${card.color}`}>
                    {isLoading ? '—' : card.value}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 p-2.5">{card.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent incidents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Incidentes Recientes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : recentIncidents.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-zinc-600">
              <CheckCircle2 className="h-8 w-8 mb-2" />
              <p className="text-sm">Sin incidentes recientes</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentIncidents.map((incident) => (
                <div key={incident.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      incident.severity === 'critical' ? 'bg-red-500 animate-pulse' :
                      incident.severity === 'high' ? 'bg-orange-500' :
                      incident.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <p className="text-sm text-white font-medium">{incident.title}</p>
                      <p className="text-xs text-zinc-500">
                        {(incident.site as { name: string } | undefined)?.name} · {formatRelativeTime(incident.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={
                    incident.severity === 'critical' ? 'panic' :
                    incident.severity === 'high' ? 'destructive' :
                    incident.severity === 'medium' ? 'warning' : 'default'
                  }>
                    {INCIDENT_SEVERITY_LABELS[incident.severity]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
