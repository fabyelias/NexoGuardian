import { useEffect, useState } from 'react'
import { Loader2, Eye, EyeOff, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useCreatePersonnel, useUpdatePersonnel, useDeletePersonnel } from '../hooks/usePersonnel'
import type { Profile } from '@/shared/types/models'
import type { UserRole } from '@/shared/types/enums'

interface PersonnelFormDialogProps {
  open: boolean
  onClose: () => void
  person?: Profile | null
}

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Administrador', description: 'Acceso total a la plataforma' },
  { value: 'supervisor', label: 'Supervisor', description: 'Seguimiento de personal e incidentes' },
  { value: 'guard', label: 'Vigilador', description: 'Operación de campo (app móvil)' },
  { value: 'client', label: 'Cliente', description: 'Solo visualiza sus reportes' },
]

function cleanupBodyLock() {
  // Radix UI sometimes leaves pointer-events:none / scroll-lock on the body
  // if a re-render interrupts the dialog exit animation. Force-clean it.
  document.body.removeAttribute('data-scroll-locked')
  document.body.style.removeProperty('pointer-events')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('padding-right')
}

export function PersonnelFormDialog({ open, onClose, person }: PersonnelFormDialogProps) {
  const create = useCreatePersonnel()
  const update = useUpdatePersonnel()
  const deletePerson = useDeletePersonnel()
  const isEditing = !!person
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'guard' as UserRole,
    phone: '',
    badge_number: '',
    id_document: '',
    address: '',
  })

  useEffect(() => {
    setError(null)
    setConfirmDelete(false)
    if (person) {
      setForm({
        email: '',
        password: '',
        first_name: person.first_name,
        last_name: person.last_name,
        role: person.role,
        phone: person.phone ?? '',
        badge_number: person.badge_number ?? '',
        id_document: person.id_document ?? '',
        address: person.address ?? '',
      })
    } else {
      setForm({ email: '', password: '', first_name: '', last_name: '', role: 'guard', phone: '', badge_number: '', id_document: '', address: '' })
    }
  }, [person, open])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function safeClose() {
    create.reset()
    update.reset()
    deletePerson.reset()
    onClose()
    // Give Radix the 200 ms animation budget, then hard-clean any leftover body lock
    setTimeout(cleanupBodyLock, 250)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (isEditing) {
        await update.mutateAsync({
          id: person!.id,
          first_name: form.first_name,
          last_name: form.last_name,
          role: form.role,
          phone: form.phone || null,
          badge_number: form.badge_number || null,
          id_document: form.id_document || null,
          address: form.address || null,
        })
      } else {
        await create.mutateAsync(form)
      }
      safeClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setError(null)
    try {
      await deletePerson.mutateAsync(person!.id)
      safeClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
      setConfirmDelete(false)
    }
  }

  const isPending = create.isPending || update.isPending || deletePerson.isPending

  return (
    <Dialog open={open} onOpenChange={o => !o && safeClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Integrante' : 'Nuevo Integrante'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-6">

            {/* Role selector */}
            <div className="space-y-2">
              <Label>Rol *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => set('role', r.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      form.role === r.value
                        ? 'border-blue-500/50 bg-blue-600/10'
                        : 'border-white/8 hover:border-white/15 hover:bg-white/2'
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{r.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{r.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Apellido *</Label>
                <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
              </div>
            </div>

            {/* Email + Password (solo al crear) */}
            {!isEditing && (
              <>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="vigilador@empresa.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contraseña *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Operational data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input placeholder="+54 11 1234-5678" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Nro. de Legajo</Label>
                <Input placeholder="LG-0001" value={form.badge_number} onChange={e => set('badge_number', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>DNI / Documento</Label>
                <Input placeholder="12.345.678" value={form.id_document} onChange={e => set('id_document', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Domicilio</Label>
                <Input placeholder="Calle 1234, Ciudad" value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-950/50 border border-red-800/50 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between">
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
                  {deletePerson.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                  {confirmDelete ? '¿Confirmar eliminación?' : 'Eliminar integrante'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={safeClose}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar cambios' : 'Crear integrante'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
