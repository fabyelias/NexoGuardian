import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Search, Pencil, Shield, UserCog,
  UserCheck, Building2, Phone, Hash,
  ToggleLeft, ToggleRight, Plus, ExternalLink,
} from 'lucide-react'
import { usePersonnel, useTogglePersonnelStatus } from '../hooks/usePersonnel'
import { PersonnelFormDialog } from '../components/PersonnelFormDialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { getInitials, formatRelativeTime } from '@/shared/lib/utils'
import type { Profile } from '@/shared/types/models'
import type { UserRole } from '@/shared/types/enums'

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: React.ReactNode }> = {
  super_admin: { label: 'Super Admin', color: 'text-violet-400', icon: <Shield className="h-3.5 w-3.5" /> },
  admin: { label: 'Administrador', color: 'text-blue-400', icon: <UserCog className="h-3.5 w-3.5" /> },
  supervisor: { label: 'Supervisor', color: 'text-amber-400', icon: <UserCheck className="h-3.5 w-3.5" /> },
  guard: { label: 'Vigilador', color: 'text-emerald-400', icon: <Shield className="h-3.5 w-3.5" /> },
  client: { label: 'Cliente', color: 'text-zinc-400', icon: <Building2 className="h-3.5 w-3.5" /> },
}

const ROLE_FILTERS: { value: UserRole | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'admin', label: 'Administradores' },
  { value: 'supervisor', label: 'Supervisores' },
  { value: 'guard', label: 'Vigiladores' },
  { value: 'client', label: 'Clientes' },
]

export function PersonnelPage() {
  const { data: personnel = [], isLoading } = usePersonnel()
  const toggleStatus = useTogglePersonnelStatus()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [editingPerson, setEditingPerson] = useState<Profile | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = personnel.filter((p) => {
    const matchesRole = roleFilter === 'all' || p.role === roleFilter
    const matchesSearch =
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (p.badge_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.phone ?? '').includes(search)
    return matchesRole && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Personal</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {personnel.length} integrante{personnel.length !== 1 ? 's' : ''} registrado{personnel.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nuevo integrante
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar por nombre, legajo o teléfono..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setRoleFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                roleFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <Users className="h-12 w-12 mb-3" />
          <p className="text-base font-medium text-zinc-400">
            {search || roleFilter !== 'all' ? 'Sin resultados' : 'No hay personal registrado'}
          </p>
          {!search && roleFilter === 'all' && (
            <p className="text-sm text-zinc-600 mt-1">
              Creá usuarios desde Supabase y asignales un rol aquí
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/2">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Integrante</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden md:table-cell">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden lg:table-cell">Legajo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 hidden lg:table-cell">Último acceso</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((person) => {
                const roleConf = ROLE_CONFIG[person.role]
                return (
                  <tr key={person.id} className="hover:bg-white/2 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={person.avatar_url ?? undefined} />
                          <AvatarFallback>{getInitials(person.first_name, person.last_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-white">
                            {person.first_name} {person.last_name}
                          </p>
                          {person.id_document && (
                            <p className="text-xs text-zinc-500">DNI: {person.id_document}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${roleConf.color}`}>
                        {roleConf.icon} {roleConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {person.phone ? (
                        <span className="flex items-center gap-1.5 text-zinc-400 text-xs">
                          <Phone className="h-3 w-3" /> {person.phone}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {person.badge_number ? (
                        <span className="flex items-center gap-1.5 text-zinc-400 text-xs">
                          <Hash className="h-3 w-3" /> {person.badge_number}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-zinc-500">
                        {person.last_seen_at ? formatRelativeTime(person.last_seen_at) : 'Nunca'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus.mutate({ id: person.id, is_active: !person.is_active })}
                        className="flex items-center gap-1.5 transition-colors"
                        title={person.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {person.is_active ? (
                          <>
                            <ToggleRight className="h-5 w-5 text-emerald-500" />
                            <span className="text-xs text-emerald-400">Activo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-5 w-5 text-zinc-600" />
                            <span className="text-xs text-zinc-500">Inactivo</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                        {(person.role === 'guard' || person.role === 'supervisor') && (
                          <button
                            onClick={() => navigate(`/personnel/${person.id}`)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/8"
                            title="Ver perfil completo"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingPerson(person)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/8"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PersonnelFormDialog
        open={creating || !!editingPerson}
        onClose={() => { setCreating(false); setEditingPerson(null) }}
        person={editingPerson}
      />
    </div>
  )
}
