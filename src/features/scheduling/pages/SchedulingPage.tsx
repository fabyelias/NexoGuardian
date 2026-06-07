import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Building2, Users } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useWeekShifts } from '../hooks/useScheduling'
import { useSites } from '@/features/sites/hooks/useSites'
import { AssignShiftDialog } from '../components/AssignShiftDialog'
import type { Shift, Site, Profile } from '@/shared/types/models'
import type { ShiftStatus } from '@/shared/types/enums'

// ─── Date helpers ───────────────────────────────────────────────────────────

function getWeekStart(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1))
  r.setHours(0, 0, 0, 0)
  return r
}

function getWeekDays(ws: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws)
    d.setDate(d.getDate() + i)
    return d
  })
}

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function fmtDayHeader(d: Date): string {
  return `${DAYS_ES[d.getDay()]} ${d.getDate()}`
}

function fmtWeekRange(days: Date[]): string {
  const a = days[0], b = days[6]
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${b.getDate()} ${MONTHS_ES[a.getMonth()]} ${a.getFullYear()}`
  }
  return `${a.getDate()} ${MONTHS_ES[a.getMonth()]} – ${b.getDate()} ${MONTHS_ES[b.getMonth()]} ${b.getFullYear()}`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function shiftBadge(start: string, end: string): string {
  const s = new Date(start), e = new Date(end)
  const diffH = (e.getTime() - s.getTime()) / 3_600_000
  const sh = s.getHours()
  if (sh === 6 && Math.round(diffH) === 12) return 'D'
  if (sh === 18 && Math.round(diffH) === 12) return 'N'
  if (Math.round(diffH) >= 23) return '24'
  return sh < 14 ? 'M' : 'T'
}

// ─── Status styles ───────────────────────────────────────────────────────────

const STATUS: Record<ShiftStatus, { dot: string; bg: string; border: string; text: string }> = {
  scheduled: { dot: 'bg-blue-500',                       bg: 'bg-blue-600/10',    border: 'border-blue-500/20',    text: 'text-blue-300'    },
  active:    { dot: 'bg-emerald-400 animate-pulse',       bg: 'bg-emerald-600/10', border: 'border-emerald-500/20', text: 'text-emerald-300' },
  completed: { dot: 'bg-zinc-600',                        bg: 'bg-zinc-800/40',    border: 'border-white/5',        text: 'text-zinc-500'    },
  absent:    { dot: 'bg-red-500',                         bg: 'bg-red-600/10',     border: 'border-red-500/20',     text: 'text-red-300'     },
}

// ─── Shift card ───────────────────────────────────────────────────────────────

function ShiftCard({ shift, onEdit }: { shift: Shift; onEdit: (s: Shift) => void }) {
  const guard = shift.guard as Profile | undefined
  const cfg = STATUS[shift.status]
  const badge = shiftBadge(shift.scheduled_start, shift.scheduled_end)

  return (
    <button
      onClick={() => onEdit(shift)}
      className={`w-full text-left rounded-lg border p-2 transition-all hover:brightness-125 ${cfg.bg} ${cfg.border}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={`text-xs font-medium truncate leading-tight ${cfg.text}`}>
          {guard ? `${guard.first_name[0]}. ${guard.last_name}` : '—'}
        </span>
        <span className={`shrink-0 text-[10px] font-bold px-1 rounded ${cfg.bg} ${cfg.text}`}>{badge}</span>
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
        <span className="text-[10px] text-zinc-500 truncate">
          {fmtTime(shift.scheduled_start)}–{fmtTime(shift.scheduled_end)}
        </span>
      </div>
    </button>
  )
}

function AddCell({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-10 rounded-lg border border-dashed border-white/5 hover:border-blue-500/30 hover:bg-blue-600/5 transition-all flex items-center justify-center group"
    >
      <Plus className="h-3 w-3 text-zinc-700 group-hover:text-blue-500 transition-colors" />
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'by-site' | 'by-guard'

type DialogState = {
  open: boolean
  siteId?: string
  guardId?: string
  date?: Date
  editShift?: Shift | null
}

export function SchedulingPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [view, setView] = useState<ViewMode>('by-site')
  const [dialog, setDialog] = useState<DialogState>({ open: false })

  const weekDays = getWeekDays(weekStart)
  const today = toDateKey(new Date())

  const { data: shifts = [], isLoading } = useWeekShifts(weekStart)
  const { data: sites = [] } = useSites()

  // Build lookup maps
  const bySite = new Map<string, Map<string, Shift[]>>()
  const byGuard = new Map<string, { guard: Profile; days: Map<string, Shift[]> }>()

  for (const s of shifts) {
    const dk = toDateKey(new Date(s.scheduled_start))
    const guard = s.guard as Profile | undefined

    if (!bySite.has(s.site_id)) bySite.set(s.site_id, new Map())
    const sm = bySite.get(s.site_id)!
    sm.set(dk, [...(sm.get(dk) ?? []), s])

    if (guard) {
      if (!byGuard.has(s.guard_id)) byGuard.set(s.guard_id, { guard, days: new Map() })
      const gd = byGuard.get(s.guard_id)!.days
      gd.set(dk, [...(gd.get(dk) ?? []), s])
    }
  }

  // Stats
  const todayShifts = shifts.filter(s => toDateKey(new Date(s.scheduled_start)) === today)
  const activeNow = shifts.filter(s => s.status === 'active').length
  const coveredSites = new Set(todayShifts.map(s => s.site_id)).size
  const coverage = sites.length ? Math.round((coveredSites / sites.length) * 100) : 0

  const openAdd = (siteId?: string, guardId?: string, date?: Date) =>
    setDialog({ open: true, siteId, guardId, date })

  const openEdit = (shift: Shift) =>
    setDialog({ open: true, editShift: shift })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Planificación</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {shifts.length} turno{shifts.length !== 1 ? 's' : ''} programado{shifts.length !== 1 ? 's' : ''} esta semana
          </p>
        </div>
        <Button onClick={() => openAdd()}>
          <Plus className="h-4 w-4" />
          Asignar turno
        </Button>
      </div>

      {/* Week nav + view toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() - 7); return d })}
            className="h-8 w-8 rounded-md border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-white min-w-[210px] text-center">
            {fmtWeekRange(weekDays)}
          </span>
          <button
            onClick={() => setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() + 7); return d })}
            className="h-8 w-8 rounded-md border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="ml-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Hoy
          </button>
        </div>

        <div className="flex rounded-md border border-white/10 overflow-hidden self-start">
          {(['by-site', 'by-guard'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              {v === 'by-site' ? <><Building2 className="h-3.5 w-3.5" /> Por Objetivo</> : <><Users className="h-3.5 w-3.5" /> Por Vigilador</>}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/8 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500">Turnos esta semana</p>
          <p className="text-2xl font-semibold text-white mt-1">{shifts.length}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500">Activos ahora</p>
          <p className={`text-2xl font-semibold mt-1 ${activeNow > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>{activeNow}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500">Cobertura hoy</p>
          <p className={`text-2xl font-semibold mt-1 ${coverage >= 80 ? 'text-emerald-400' : coverage >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {coverage}%
          </p>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="h-72 rounded-xl bg-white/5 animate-pulse" />
      ) : view === 'by-site' ? (
        <BySiteGrid
          sites={sites}
          weekDays={weekDays}
          bySite={bySite}
          today={today}
          onAdd={(siteId, date) => openAdd(siteId, undefined, date)}
          onEdit={openEdit}
        />
      ) : (
        <ByGuardGrid
          guards={[...byGuard.values()].map(v => v.guard)}
          weekDays={weekDays}
          byGuard={byGuard}
          today={today}
          onAdd={(guardId, date) => openAdd(undefined, guardId, date)}
          onEdit={openEdit}
        />
      )}

      <AssignShiftDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        defaultSiteId={dialog.siteId}
        defaultGuardId={dialog.guardId}
        defaultDate={dialog.date}
        editShift={dialog.editShift}
      />
    </div>
  )
}

// ─── By-site grid ─────────────────────────────────────────────────────────────

function BySiteGrid({ sites, weekDays, bySite, today, onAdd, onEdit }: {
  sites: Site[]
  weekDays: Date[]
  bySite: Map<string, Map<string, Shift[]>>
  today: string
  onAdd: (siteId: string, date: Date) => void
  onEdit: (s: Shift) => void
}) {
  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-zinc-600">
        <Building2 className="h-10 w-10 mb-3" />
        <p className="text-sm text-zinc-400">No hay objetivos registrados</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/8">
      <table className="w-full text-sm" style={{ minWidth: 780 }}>
        <thead>
          <tr className="border-b border-white/8 bg-zinc-900/80">
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 sticky left-0 bg-zinc-900/95 w-36">
              Objetivo
            </th>
            {weekDays.map(day => {
              const key = toDateKey(day)
              const isToday = key === today
              return (
                <th key={key} className={`px-1.5 py-3 text-xs font-medium text-center w-[110px] ${isToday ? 'text-blue-400' : 'text-zinc-500'}`}>
                  {fmtDayHeader(day)}
                  {isToday && <span className="ml-1 inline-block h-1 w-1 rounded-full bg-blue-500 align-middle mb-0.5" />}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sites.map(site => {
            const sm = bySite.get(site.id)
            return (
              <tr key={site.id} className="hover:bg-white/[0.01] transition-colors">
                <td className="px-4 py-2 sticky left-0 bg-[#0a0a0a] align-top">
                  <span className="text-xs font-medium text-zinc-300 leading-snug line-clamp-2">{site.name}</span>
                </td>
                {weekDays.map(day => {
                  const key = toDateKey(day)
                  const dayShifts = sm?.get(key) ?? []
                  return (
                    <td key={key} className="px-1.5 py-2 align-top">
                      <div className="space-y-1">
                        {dayShifts.map(s => <ShiftCard key={s.id} shift={s} onEdit={onEdit} />)}
                        <AddCell onClick={() => onAdd(site.id, day)} />
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── By-guard grid ────────────────────────────────────────────────────────────

function ByGuardGrid({ guards, weekDays, byGuard, today, onAdd, onEdit }: {
  guards: Profile[]
  weekDays: Date[]
  byGuard: Map<string, { guard: Profile; days: Map<string, Shift[]> }>
  today: string
  onAdd: (guardId: string, date: Date) => void
  onEdit: (s: Shift) => void
}) {
  if (guards.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-zinc-600">
        <Users className="h-10 w-10 mb-3" />
        <p className="text-sm text-zinc-400">No hay turnos asignados esta semana</p>
        <p className="text-xs text-zinc-600 mt-1">Asigná turnos para ver el historial por vigilador</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/8">
      <table className="w-full text-sm" style={{ minWidth: 780 }}>
        <thead>
          <tr className="border-b border-white/8 bg-zinc-900/80">
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 sticky left-0 bg-zinc-900/95 w-36">
              Vigilador
            </th>
            {weekDays.map(day => {
              const key = toDateKey(day)
              const isToday = key === today
              return (
                <th key={key} className={`px-1.5 py-3 text-xs font-medium text-center w-[110px] ${isToday ? 'text-blue-400' : 'text-zinc-500'}`}>
                  {fmtDayHeader(day)}
                  {isToday && <span className="ml-1 inline-block h-1 w-1 rounded-full bg-blue-500 align-middle mb-0.5" />}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {guards.map(guard => {
            const gd = byGuard.get(guard.id)?.days
            return (
              <tr key={guard.id} className="hover:bg-white/[0.01] transition-colors">
                <td className="px-4 py-2 sticky left-0 bg-[#0a0a0a] align-top">
                  <p className="text-xs font-medium text-zinc-300">{guard.first_name} {guard.last_name}</p>
                  {guard.badge_number && <p className="text-[10px] text-zinc-600">#{guard.badge_number}</p>}
                </td>
                {weekDays.map(day => {
                  const key = toDateKey(day)
                  const dayShifts = gd?.get(key) ?? []
                  return (
                    <td key={key} className="px-1.5 py-2 align-top">
                      <div className="space-y-1">
                        {dayShifts.map(s => <ShiftCard key={s.id} shift={s} onEdit={onEdit} />)}
                        <AddCell onClick={() => onAdd(guard.id, day)} />
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
