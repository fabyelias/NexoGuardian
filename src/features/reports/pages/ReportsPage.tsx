import { useState } from 'react'
import {
  FileText, Download, AlertTriangle, Calendar,
  Shield, TrendingUp, Loader2, CheckCircle2,
  Clock, Filter,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useSites } from '@/features/sites/hooks/useSites'
import { useIncidents } from '@/features/incidents/hooks/useIncidents'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { generateIncidentsReport, generateShiftReport } from '../services/pdfService'
import type { Incident, Shift, GuardLog, PatrolSession } from '@/shared/types/models'
import { INCIDENT_SEVERITY_LABELS } from '@/shared/types/enums'

type DateRange = '7d' | '30d' | '90d' | 'custom'

export function ReportsPage() {
  const { profile } = useAuthStore()
  const { data: sites = [] } = useSites()
  const { data: allIncidents = [] } = useIncidents()

  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedSite, setSelectedSite] = useState('all')
  const [isGeneratingIncidents, setIsGeneratingIncidents] = useState(false)
  const [isGeneratingShift, setIsGeneratingShift] = useState(false)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [selectedShift, setSelectedShift] = useState('')
  const [loadingShifts, setLoadingShifts] = useState(false)

  const orgName = 'NexoGuard'

  function getDateFrom(): Date {
    const now = new Date()
    if (dateRange === '7d') return new Date(now.getTime() - 7 * 86400000)
    if (dateRange === '30d') return new Date(now.getTime() - 30 * 86400000)
    if (dateRange === '90d') return new Date(now.getTime() - 90 * 86400000)
    return customFrom ? new Date(customFrom) : new Date(now.getTime() - 30 * 86400000)
  }

  function getDateTo(): Date {
    return dateRange === 'custom' && customTo ? new Date(customTo) : new Date()
  }

  function getDateRangeLabel(): string {
    const from = getDateFrom()
    const to = getDateTo()
    return `${from.toLocaleDateString('es-AR')} — ${to.toLocaleDateString('es-AR')}`
  }

  const filteredIncidents = allIncidents.filter(i => {
    const date = new Date(i.created_at)
    const matchesSite = selectedSite === 'all' || i.site_id === selectedSite
    return date >= getDateFrom() && date <= getDateTo() && matchesSite
  })

  // Stats
  const openCount = filteredIncidents.filter(i => i.status === 'open' || i.status === 'in_progress').length
  const resolvedCount = filteredIncidents.filter(i => i.status === 'resolved' || i.status === 'closed').length
  const criticalCount = filteredIncidents.filter(i => i.severity === 'critical' || i.is_panic).length

  async function handleGenerateIncidents() {
    setIsGeneratingIncidents(true)
    try {
      generateIncidentsReport(filteredIncidents, orgName, getDateRangeLabel())
    } finally {
      setIsGeneratingIncidents(false)
    }
  }

  async function loadShifts() {
    setLoadingShifts(true)
    const { data } = await supabase
      .from('shifts')
      .select('*, guard:profiles!guard_id(first_name, last_name), site:sites(name)')
      .eq('organization_id', profile!.organization_id)
      .in('status', ['completed', 'active'])
      .order('actual_start', { ascending: false })
      .limit(30)
    setShifts((data ?? []) as Shift[])
    setLoadingShifts(false)
  }

  async function handleGenerateShiftReport() {
    if (!selectedShift) return
    setIsGeneratingShift(true)

    const shift = shifts.find(s => s.id === selectedShift)
    if (!shift) { setIsGeneratingShift(false); return }

    const [logsRes, patrolsRes] = await Promise.all([
      supabase.from('guard_logs').select('*').eq('shift_id', selectedShift).order('recorded_at'),
      supabase.from('patrol_sessions').select('*').eq('shift_id', selectedShift),
    ])

    generateShiftReport(
      shift,
      (logsRes.data ?? []) as GuardLog[],
      (patrolsRes.data ?? []) as PatrolSession[],
      orgName
    )
    setIsGeneratingShift(false)
  }

  const topCategories = Object.entries(
    filteredIncidents.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 4)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-white">Informes</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Generación y exportación de reportes operativos en PDF</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-zinc-400" /> Filtros del período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([['7d', 'Últimos 7 días'], ['30d', 'Últimos 30 días'], ['90d', 'Últimos 90 días'], ['custom', 'Personalizado']] as [DateRange, string][]).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setDateRange(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${dateRange === v ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Desde</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="flex h-9 rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Hasta</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="flex h-9 rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-zinc-500">Objetivo</label>
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
              className="flex h-9 w-64 rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos los objetivos</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total incidentes', value: filteredIncidents.length, icon: <AlertTriangle className="h-4 w-4 text-amber-400" />, color: 'text-amber-400' },
          { label: 'Abiertos', value: openCount, icon: <Clock className="h-4 w-4 text-red-400" />, color: 'text-red-400' },
          { label: 'Resueltos', value: resolvedCount, icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, color: 'text-emerald-400' },
          { label: 'Críticos / Pánico', value: criticalCount, icon: <Shield className="h-4 w-4 text-violet-400" />, color: 'text-violet-400' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2">{stat.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Incidents report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Informe de Incidentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-400">
              Exporta un PDF con todos los incidentes del período seleccionado, incluyendo estadísticas y detalle por evento.
            </p>
            <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-400 space-y-1">
              <p>· Período: <span className="text-zinc-300">{getDateRangeLabel()}</span></p>
              <p>· Incidentes: <span className="text-zinc-300">{filteredIncidents.length}</span></p>
              <p>· Sitio: <span className="text-zinc-300">{selectedSite === 'all' ? 'Todos' : sites.find(s => s.id === selectedSite)?.name}</span></p>
            </div>
            {topCategories.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 mb-2">Principales categorías</p>
                {topCategories.map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">{cat}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={handleGenerateIncidents} disabled={isGeneratingIncidents || filteredIncidents.length === 0}>
              {isGeneratingIncidents ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar PDF
            </Button>
          </CardContent>
        </Card>

        {/* Shift report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              Informe de Turno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-400">
              Genera un informe completo de un turno específico: novedades, rondines y estado final.
            </p>
            <div className="space-y-2">
              <Button variant="outline" size="sm" onClick={loadShifts} disabled={loadingShifts}>
                {loadingShifts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                Cargar turnos recientes
              </Button>
              {shifts.length > 0 && (
                <select
                  value={selectedShift}
                  onChange={e => setSelectedShift(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Seleccionar turno...</option>
                  {shifts.map(s => {
                    const guard = s.guard as { first_name: string; last_name: string } | undefined
                    const site = s.site as { name: string } | undefined
                    return (
                      <option key={s.id} value={s.id}>
                        {guard ? `${guard.first_name} ${guard.last_name}` : '—'} — {site?.name ?? '—'} ({new Date(s.scheduled_start).toLocaleDateString('es-AR')})
                      </option>
                    )
                  })}
                </select>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleGenerateShiftReport}
              disabled={isGeneratingShift || !selectedShift}
            >
              {isGeneratingShift ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
