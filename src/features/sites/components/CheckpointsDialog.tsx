import { useState } from 'react'
import {
  Loader2, Plus, Pencil, Trash2, QrCode, Printer,
  MapPin, GripVertical, Check, X,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import {
  useCheckpoints,
  useCreateCheckpoint,
  useUpdateCheckpoint,
  useDeleteCheckpoint,
} from '../hooks/useCheckpointAdmin'
import { printCheckpointQRs } from '../services/qrPdfService'
import type { Site, Checkpoint } from '@/shared/types/models'

interface CheckpointsDialogProps {
  open: boolean
  onClose: () => void
  site: Site
}

interface CheckpointFormState {
  name: string
  description: string
}

const EMPTY_FORM: CheckpointFormState = { name: '', description: '' }

export function CheckpointsDialog({ open, onClose, site }: CheckpointsDialogProps) {
  const { data: checkpoints = [], isLoading } = useCheckpoints(site.id)
  const create = useCreateCheckpoint()
  const update = useUpdateCheckpoint()
  const deleteCP = useDeleteCheckpoint()

  const [form, setForm] = useState<CheckpointFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  function openEdit(cp: Checkpoint) {
    setEditingId(cp.id)
    setForm({ name: cp.name, description: cp.description ?? '' })
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setError(null)
    try {
      if (editingId) {
        await update.mutateAsync({
          id: editingId,
          site_id: site.id,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        })
      } else {
        await create.mutateAsync({
          site_id: site.id,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        })
      }
      cancelForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function handleDelete(cp: Checkpoint) {
    if (confirmDeleteId !== cp.id) {
      setConfirmDeleteId(cp.id)
      return
    }
    try {
      await deleteCP.mutateAsync({ id: cp.id, site_id: site.id })
      setConfirmDeleteId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  async function handlePrint() {
    if (checkpoints.length === 0) return
    setPrinting(true)
    try {
      await printCheckpointQRs(site, checkpoints)
    } finally {
      setPrinting(false)
    }
  }

  const isSaving = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-blue-400" />
                Checkpoints — {site.name}
              </DialogTitle>
              <p className="text-xs text-zinc-500 mt-0.5">
                {checkpoints.length} punto{checkpoints.length !== 1 ? 's' : ''} de control
              </p>
            </div>
            <div className="flex gap-2 mr-6">
              {checkpoints.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={printing}
                >
                  {printing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Printer className="h-3.5 w-3.5" />
                  }
                  Imprimir QRs
                </Button>
              )}
              <Button size="sm" onClick={openCreate} disabled={showForm}>
                <Plus className="h-3.5 w-3.5" /> Agregar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 px-1 py-2">
          {/* Inline form */}
          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-blue-500/30 bg-blue-600/5 p-4 space-y-3"
            >
              <p className="text-sm font-medium text-white">
                {editingId ? 'Editar checkpoint' : 'Nuevo checkpoint'}
              </p>
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input
                  placeholder="ej. Entrada Principal"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Input
                  placeholder="ej. Portón metálico, lado norte"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={cancelForm}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingId ? 'Guardar' : 'Agregar checkpoint'}
                </Button>
              </div>
            </form>
          )}

          {/* Checkpoint list */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : checkpoints.length === 0 && !showForm ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <MapPin className="h-10 w-10 mb-3" />
              <p className="text-sm font-medium text-zinc-400">Sin checkpoints</p>
              <p className="text-xs text-zinc-600 mt-1">Agregá puntos de control para los rondines</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" /> Agregar primer checkpoint
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {checkpoints.map((cp, idx) => (
                <div
                  key={cp.id}
                  className="group flex items-center gap-3 rounded-lg border border-white/8 bg-white/2 px-4 py-3 hover:border-white/15 transition-colors"
                >
                  {/* Order handle visual */}
                  <div className="flex items-center gap-1 text-zinc-700">
                    <GripVertical className="h-3.5 w-3.5" />
                    <span className="text-xs font-mono w-4 text-center">{idx + 1}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{cp.name}</p>
                      {!cp.is_active && (
                        <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>
                      )}
                    </div>
                    {cp.description && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{cp.description}</p>
                    )}
                    <p className="text-[10px] text-zinc-700 font-mono mt-0.5 truncate">
                      QR: {cp.qr_code}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => openEdit(cp)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/8 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cp)}
                      disabled={deleteCP.isPending}
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                        confirmDeleteId === cp.id
                          ? 'text-red-400 bg-red-950/40 hover:bg-red-950/60'
                          : 'text-zinc-500 hover:text-red-400 hover:bg-red-950/30'
                      }`}
                      title={confirmDeleteId === cp.id ? '¿Confirmar?' : 'Eliminar'}
                    >
                      {deleteCP.isPending && confirmDeleteId === cp.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : confirmDeleteId === cp.id
                          ? <Check className="h-3.5 w-3.5" />
                          : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </button>
                    {confirmDeleteId === cp.id && (
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/8 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {checkpoints.length > 0 && (
          <div className="border-t border-white/8 pt-3">
            <p className="text-xs text-zinc-600 text-center">
              Los QRs impresos se exportan en PDF · 2 por hoja A4 · listos para laminar
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
