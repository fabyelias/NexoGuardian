import { useState } from 'react'
import {
  Building2, Plus, Search, Pencil, Trash2,
  MapPin, Phone, Mail, CheckCircle2, XCircle,
} from 'lucide-react'
import { useSites, useDeleteSite } from '../hooks/useSites'
import { SiteFormDialog } from '../components/SiteFormDialog'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'
import type { Site } from '@/shared/types/models'

export function SitesPage() {
  const { data: sites = [], isLoading } = useSites()
  const deleteSite = useDeleteSite()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [deletingSite, setDeletingSite] = useState<Site | null>(null)

  const filtered = sites.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase())
  )

  function handleEdit(site: Site) {
    setEditingSite(site)
    setFormOpen(true)
  }

  function handleCloseForm() {
    setFormOpen(false)
    setEditingSite(null)
  }

  async function handleDelete() {
    if (!deletingSite) return
    await deleteSite.mutateAsync(deletingSite.id)
    setDeletingSite(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Objetivos Protegidos</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {sites.length} objetivo{sites.length !== 1 ? 's' : ''} registrado{sites.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Nuevo objetivo
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Buscar por nombre o dirección..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <Building2 className="h-12 w-12 mb-3" />
          <p className="text-base font-medium text-zinc-400">
            {search ? 'Sin resultados para tu búsqueda' : 'No hay objetivos registrados'}
          </p>
          {!search && (
            <Button variant="outline" className="mt-4" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Agregar primer objetivo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((site) => (
            <Card key={site.id} className="group hover:border-white/15 transition-colors">
              <CardContent className="p-5 space-y-3">
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/20">
                      <Building2 className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{site.name}</p>
                      <Badge variant={site.is_active ? 'success' : 'secondary'} className="mt-0.5">
                        {site.is_active ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" />Activo</>
                        ) : (
                          <><XCircle className="h-3 w-3 mr-1" />Inactivo</>
                        )}
                      </Badge>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleEdit(site)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/8 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingSite(site)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-sm text-zinc-400">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                    <span className="truncate">{site.address}</span>
                  </p>
                  {site.contact_name && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                      <span className="truncate">
                        {site.contact_name}
                        {site.contact_phone && ` · ${site.contact_phone}`}
                      </span>
                    </p>
                  )}
                  {site.contact_email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                      <span className="truncate">{site.contact_email}</span>
                    </p>
                  )}
                </div>

                {/* Consignas preview */}
                {site.consignas && (
                  <p className="text-xs text-zinc-600 border-t border-white/5 pt-3 line-clamp-2">
                    {site.consignas}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <SiteFormDialog
        open={formOpen}
        onClose={handleCloseForm}
        site={editingSite}
      />
      <DeleteConfirmDialog
        open={!!deletingSite}
        onClose={() => setDeletingSite(null)}
        onConfirm={handleDelete}
        title={deletingSite?.name ?? ''}
        description={`¿Eliminar "${deletingSite?.name}"? Se borrarán también sus puntos de control asociados.`}
        isPending={deleteSite.isPending}
      />
    </div>
  )
}
