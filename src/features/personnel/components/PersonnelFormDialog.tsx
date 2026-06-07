import { useEffect, useState } from 'react'
import { Loader2, Info } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useUpdatePersonnel } from '../hooks/usePersonnel'
import type { Profile } from '@/shared/types/models'
import type { UserRole } from '@/shared/types/enums'

interface PersonnelFormDialogProps {
  open: boolean
  onClose: () => void
  person?: Profile | null
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'guard', label: 'Vigilador' },
  { value: 'client', label: 'Cliente' },
]

export function PersonnelFormDialog({ open, onClose, person }: PersonnelFormDialogProps) {
  const update = useUpdatePersonnel()
  const isEditing = !!person

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '',
    badge_number: '', id_document: '', address: '',
    role: 'guard' as UserRole,
  })

  useEffect(() => {
    if (person) {
      setForm({
        first_name: person.first_name,
        last_name: person.last_name,
        phone: person.phone ?? '',
        badge_number: person.badge_number ?? '',
        id_document: person.id_document ?? '',
        address: person.address ?? '',
        role: person.role,
      })
    } else {
      setForm({ first_name: '', last_name: '', phone: '', badge_number: '', id_document: '', address: '', role: 'guard' })
    }
  }, [person, open])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!person) return
    await update.mutateAsync({ id: person.id, ...form })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Perfil' : 'Nuevo Integrante'}</DialogTitle>
          {!isEditing && (
            <DialogDescription className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-blue-950/30 border border-blue-800/30 text-blue-400 text-xs">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Para crear usuarios nuevos, creá el acceso desde <strong>Supabase → Authentication → Add user</strong> y luego editá su perfil aquí.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Apellido *</Label>
                <Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Rol *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input placeholder="+54 11 1234-5678" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Nro. de Legajo / Badge</Label>
                <Input placeholder="LG-0001" value={form.badge_number} onChange={(e) => set('badge_number', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>DNI / Documento</Label>
                <Input placeholder="12.345.678" value={form.id_document} onChange={(e) => set('id_document', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Domicilio</Label>
                <Input placeholder="Calle 1234, Ciudad" value={form.address} onChange={(e) => set('address', e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            {isEditing && (
              <Button type="submit" disabled={update.isPending}>
                {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
