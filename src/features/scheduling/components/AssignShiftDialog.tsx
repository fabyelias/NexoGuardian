import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useCreateShift, useUpdateShift, useDeleteShift } from '../hooks/useScheduling'
import { usePersonnel } from '@/features/personnel/hooks/usePersonnel'
import { useSites } from '@/features/sites/hooks/useSites'
import type { Shift } from '@/shared/types/models'

interface AssignShiftDialogProps {
  open: boolean
  onClose: () => void
  defaultSiteId?: string
  defaultGuardId?: string
  defaultDate?: Date
  editShift?: Shift | null
}

const PRESETS = [
  { id: 'diurno',   label: 'Diurno',      startH: 6,  endH: 18, nextDay: false },
  { id: 'nocturno', label: 'Nocturno',     startH: 18, endH: 6,  nextDay: true  },
  { id: '24h',      label: '24 Horas',     startH: 6,  endH: 6,  nextDay: true  },
  { id: 'custom',   label: 'Personalizado',startH: 8,  endH: 16, nextDay: false },
]

function pad(n: number) { return String(n).padStart(2, '0') }

function toLocalDT(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function applyPreset(base: Date, preset: typeof PRESETS[0]) {
  const start = new Date(base)
  start.setHours(preset.startH, 0, 0, 0)
  const end = new Date(base)
  if (preset.nextDay) end.setDate(end.getDate() + 1)
  end.setHours(preset.endH, 0, 0, 0)
  return { start: toLocalDT(start), end: toLocalDT(end) }
}

export function AssignShiftDialog({
  open, onClose, defaultSiteId, defaultGuardId, defaultDate, editShift,
}: AssignShiftDialogProps) {
  const create = useCreateShift()
  const update = useUpdateShift()
  const del = useDeleteShift()

  const { data: guards = [] } = usePersonnel('guard')
  const { data: supervisors = [] } = usePersonnel('supervisor')
  const allGuards = [...guards, ...supervisors]
  const { data: sites = [] } = useSites()

  const isEditing = !!editShift
  const [guardSearch, setGuardSearch] = useState('')
  const [selectedGuardId, setSelectedGuardId] = useState('')
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [preset, setPreset] = useState('diurno')
  const [startDt, setStartDt] = useState('')
  const [endDt, setEndDt] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const baseDate = defaultDate ?? new Date()

  useEffect(() => {
    if (!open) return
    setError(null)
    setConfirmDelete(false)
    setGuardSearch('')

    if (editShift) {
      setSelectedGuardId(editShift.guard_id)
      setSelectedSiteId(editShift.site_id)
      setStartDt(toLocalDT(new Date(editShift.scheduled_start)))
      setEndDt(toLocalDT(new Date(editShift.scheduled_end)))
      setNotes(editShift.notes ?? '')
      setPreset('custom')
    } else {
      const p = PRESETS.find(x => x.id === 'diurno')!
      const { start, end } = applyPreset(baseDate, p)
      setSelectedGuardId(defaultGuardId ?? '')
      setSelectedSiteId(defaultSiteId ?? '')
      setStartDt(start)
      setEndDt(end)
      setNotes('')
      setPreset('diurno')
    }
  }, [open])

  function handlePreset(id: string) {
    setPreset(id)
    if (id === 'custom') return
    const p = PRESETS.find(x => x.id === id)!
    const ref = startDt ? new Date(startDt) : baseDate
    const { start, end } = applyPreset(ref, p)
    setStartDt(start)
    setEndDt(end)
  }

  const filteredGuards = allGuards.filter(g =>
    `${g.first_name} ${g.last_name}`.toLowerCase().includes(guardSearch.toLowerCase()) ||
    (g.badge_number ?? '').toLowerCase().includes(guardSearch.toLowerCase())
  )

  const selectedGuard = allGuards.find(g => g.id === selectedGuardId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedGuardId || !selectedSiteId) {
      setError('Seleccioná un vigilador y un objetivo')
      return
    }
    try {
      const payload = {
        guard_id: selectedGuardId,
        site_id: selectedSiteId,
        scheduled_start: new Date(startDt).toISOString(),
        scheduled_end: new Date(endDt).toISOString(),
        notes: notes || undefined,
      }
      if (isEditing) {
        await update.mutateAsync({ id: editShift!.id, ...payload })
      } else {
        await create.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    try {
      await del.mutateAsync(editShift!.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  const isPending = create.isPending || update.isPending || del.isPending

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Turno' : 'Asignar Turno'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 pb-2">

            {/* Guard selector */}
            <div className="space-y-1.5">
              <Label>Vigilador / Supervisor *</Label>
              <div className="relative">
                <Input
                  placeholder="Buscar por nombre o legajo..."
                  value={guardSearch !== '' ? guardSearch : selectedGuard ? `${selectedGuard.first_name} ${selectedGuard.last_name}` : ''}
                  onChange={e => { setGuardSearch(e.target.value); setSelectedGuardId('') }}
                  onFocus={() => setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                />
                {dropdownOpen && (
                  <div className="absolute z-50 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-white/10 bg-zinc-900 shadow-xl">
                    {filteredGuards.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-zinc-500">Sin resultados</p>
                    ) : filteredGuards.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedGuardId(g.id)
                          setGuardSearch('')
                          setDropdownOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left"
                      >
                        <span className="text-white">{g.first_name} {g.last_name}</span>
                        {g.badge_number && <span className="text-zinc-500 text-xs">#{g.badge_number}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Site selector */}
            <div className="space-y-1.5">
              <Label>Objetivo *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                value={selectedSiteId}
                onChange={e => setSelectedSiteId(e.target.value)}
                required
              >
                <option value="">Seleccionar objetivo...</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Shift type */}
            <div className="space-y-1.5">
              <Label>Tipo de turno</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePreset(p.id)}
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      preset === p.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date/time range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Inicio *</Label>
                <Input
                  type="datetime-local"
                  value={startDt}
                  onChange={e => { setStartDt(e.target.value); setPreset('custom') }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fin *</Label>
                <Input
                  type="datetime-local"
                  value={endDt}
                  onChange={e => { setEndDt(e.target.value); setPreset('custom') }}
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notas <span className="text-zinc-600">(opcional)</span></Label>
              <Input
                placeholder="Instrucciones especiales para este turno..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-950/50 border border-red-800/50 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="px-6 pb-6 flex items-center justify-between">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isPending}
                  className={confirmDelete ? 'text-red-400 hover:text-red-300' : 'text-zinc-500 hover:text-red-400'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {confirmDelete ? '¿Confirmar?' : 'Eliminar'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isPending || !selectedGuardId || !selectedSiteId}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar cambios' : 'Asignar turno'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
