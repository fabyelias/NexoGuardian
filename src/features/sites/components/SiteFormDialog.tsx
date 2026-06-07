import { useEffect, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { useCreateSite, useUpdateSite } from '../hooks/useSites'
import type { Site } from '@/shared/types/models'

interface SiteFormDialogProps {
  open: boolean
  onClose: () => void
  site?: Site | null
}

const EMPTY: Partial<Site> = {
  name: '', address: '', contact_name: '', contact_phone: '',
  contact_email: '', consignas: '', is_active: true,
}

export function SiteFormDialog({ open, onClose, site }: SiteFormDialogProps) {
  const create = useCreateSite()
  const update = useUpdateSite()
  const isEditing = !!site
  const [form, setForm] = useState<Partial<Site>>(EMPTY)

  useEffect(() => {
    setForm(site ? { ...site } : EMPTY)
  }, [site, open])

  function set(field: keyof Site, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEditing) {
      await update.mutateAsync({ id: site!.id, ...form })
    } else {
      await create.mutateAsync(form as Omit<Site, 'id' | 'created_at' | 'updated_at'>)
    }
    onClose()
  }

  const isPending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Objetivo' : 'Nuevo Objetivo Protegido'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Nombre del objetivo *</Label>
                <Input
                  placeholder="Ej: Planta Industrial Norte"
                  value={form.name ?? ''}
                  onChange={(e) => set('name', e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Dirección *
                </Label>
                <Input
                  placeholder="Av. Industrial 1234, Ciudad"
                  value={form.address ?? ''}
                  onChange={(e) => set('address', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contacto</Label>
                <Input
                  placeholder="Nombre del responsable"
                  value={form.contact_name ?? ''}
                  onChange={(e) => set('contact_name', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono de contacto</Label>
                <Input
                  placeholder="+54 11 1234-5678"
                  value={form.contact_phone ?? ''}
                  onChange={(e) => set('contact_phone', e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Email de contacto</Label>
                <Input
                  type="email"
                  placeholder="contacto@empresa.com"
                  value={form.contact_email ?? ''}
                  onChange={(e) => set('contact_email', e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Consignas / Instrucciones</Label>
                <Textarea
                  placeholder="Instrucciones específicas para el personal en este objetivo..."
                  rows={3}
                  value={form.consignas ?? ''}
                  onChange={(e) => set('consignas', e.target.value)}
                />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active ?? true}
                  onChange={(e) => set('is_active', e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-zinc-800 accent-blue-500"
                />
                <Label htmlFor="is_active">Objetivo activo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar cambios' : 'Crear objetivo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
