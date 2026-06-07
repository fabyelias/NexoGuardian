import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Phone, Hash, FileText,
  Clock, MapPin, Shield, BookOpen, Route, Building2,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { useGuardMonthShifts } from '@/features/scheduling/hooks/useScheduling'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { getInitials, formatDate } from '@/shared/lib/utils'
import type { Profile, Site } from '@/shared/types/models'
import type { ShiftStatus } from '@/shared/types/enums'

const STATUS_LABEL: Record<ShiftStatus, { label: string; color: string }> = {
  scheduled: { label: 'Programado', color: 'text-blue-400' },
  active:    { label: 'Activo',     color: 'text-emerald-400' },
  completed: { label: 'Completado', color: 'text-zinc-400' },
  absent:    { label: 'Ausente',    color: 'text-red-400' },
}

interface MonthStats {
  shiftsWorked: number
  sitesVisited: number
  logsWritten: number
  patrols: number
}

export function GuardProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile: myProfile } = useAuthStore()
  const orgId = myProfile?.organization_id

  const [guard, setGuard] = useState<Profile | null>(null)
  const [stats, setStats] = useState<MonthStats>({ shiftsWorked: 0, sitesVisited: 0, logsWritten: 0, patrols: 0 })
  const [loading, setLoading] = useState(true)

  const { data: monthShifts = [] } = useGuardMonthShifts(id ?? '')

  useEffect(() => {
    if (!id || !orgId) return

    async function load() {
      setLoading(true)
      try {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

        const [profileRes, logsRes, patrolsRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', id!).eq('organization_id', orgId!).maybeSingle(),
          supabase.from('guard_logs').select('id', { count: 'exact' })
            .eq('guard_id', id!).eq('organization_id', orgId!)
            .gte('recorded_at', monthStart).lt('recorded_at', monthEnd),
          supabase.from('patrol_sessions').select('id', { count: 'exact' })
            .eq('guard_id', id!).eq('organization_id', orgId!)
            .gte('started_at', monthStart).lt('started_at', monthEnd),
        ])

        if (profileRes.data) setGuard(profileRes.data as Profile)

        const completedShifts = monthShifts.filter(s => s.status === 'completed' || s.status === 'active').length
        const uniqueSites = new Set(monthShifts.map(s => s.site_id)).size

        setStats({
          shiftsWorked: completedShifts,
          sitesVisited: uniqueSites,
          logsWritten: logsRes.count ?? 0,
          patrols: patrolsRes.count ?? 0,
        })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, orgId, monthShifts.length])

  const now = new Date()
  const monthName = now.toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="h-32 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
      </div>
    )
  }

  if (!guard) {
    return (
      <div className="flex flex-col items-center py-20 text-zinc-600">
        <User className="h-12 w-12 mb-3" />
        <p className="text-sm text-zinc-400">Perfil no encontrado</p>
        <button onClick={() => navigate('/personnel')} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
          Volver al listado
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => navigate('/personnel')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Personal
      </button>

      {/* Profile card */}
      <div className="rounded-xl border border-white/8 bg-zinc-900/60 p-6">
        <div className="flex items-start gap-5">
          <Avatar className="h-16 w-16">
            <AvatarImage src={guard.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg">{getInitials(guard.first_name, guard.last_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {guard.first_name} {guard.last_name}
                </h2>
                <p className="text-sm text-zinc-500 capitalize mt-0.5">{guard.role.replace('_', ' ')}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                guard.is_active
                  ? 'border-emerald-500/30 bg-emerald-600/10 text-emerald-400'
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-500'
              }`}>
                {guard.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
              {guard.badge_number && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Hash className="h-3.5 w-3.5 text-zinc-600" />
                  Legajo: {guard.badge_number}
                </span>
              )}
              {guard.phone && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Phone className="h-3.5 w-3.5 text-zinc-600" />
                  {guard.phone}
                </span>
              )}
              {guard.id_document && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <FileText className="h-3.5 w-3.5 text-zinc-600" />
                  DNI: {guard.id_document}
                </span>
              )}
              {guard.address && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <MapPin className="h-3.5 w-3.5 text-zinc-600" />
                  {guard.address}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Month stats */}
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Actividad — {monthName}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <Shield className="h-5 w-5" />, value: stats.shiftsWorked, label: 'Turnos trabajados', color: 'text-blue-400' },
            { icon: <Building2 className="h-5 w-5" />, value: stats.sitesVisited, label: 'Objetivos distintos', color: 'text-violet-400' },
            { icon: <BookOpen className="h-5 w-5" />, value: stats.logsWritten, label: 'Novedades escritas', color: 'text-amber-400' },
            { icon: <Route className="h-5 w-5" />, value: stats.patrols, label: 'Rondines realizados', color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-zinc-900/60 p-4">
              <div className={`${s.color} mb-2`}>{s.icon}</div>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Shifts this month */}
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Turnos del mes
        </h3>
        {monthShifts.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-zinc-900/60 py-10 flex flex-col items-center text-zinc-600">
            <Clock className="h-8 w-8 mb-2" />
            <p className="text-sm text-zinc-500">Sin turnos este mes</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/8 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-zinc-900/80">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Objetivo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 hidden sm:table-cell">Inicio</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 hidden sm:table-cell">Fin</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {monthShifts.map(shift => {
                  const site = shift.site as Site | undefined
                  const cfg = STATUS_LABEL[shift.status]
                  return (
                    <tr key={shift.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="text-sm text-zinc-300">{site?.name ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className="text-xs text-zinc-400">{formatDate(shift.scheduled_start)}</span>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className="text-xs text-zinc-400">{formatDate(shift.scheduled_end)}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

