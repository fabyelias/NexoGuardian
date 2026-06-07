import { NavLink, useLocation } from 'react-router-dom'
import {
  Shield,
  LayoutDashboard,
  AlertTriangle,
  Route,
  Users,
  Building2,
  FileText,
  Radio,
  BookOpen,
  LogOut,
  Bell,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { useSignOut } from '@/features/auth/hooks/useAuth'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { getInitials } from '@/shared/lib/utils'
import type { UserRole } from '@/shared/types/enums'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  roles: UserRole[]
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    label: 'Dashboard',
    roles: ['super_admin', 'admin', 'supervisor', 'guard', 'client'],
  },
  {
    to: '/monitoring',
    icon: <Radio className="h-4 w-4" />,
    label: 'Centro de Monitoreo',
    roles: ['super_admin', 'admin', 'supervisor'],
  },
  {
    to: '/incidents',
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Incidentes',
    roles: ['super_admin', 'admin', 'supervisor', 'guard', 'client'],
  },
  {
    to: '/patrols',
    icon: <Route className="h-4 w-4" />,
    label: 'Rondines',
    roles: ['super_admin', 'admin', 'supervisor', 'guard'],
  },
  {
    to: '/guard-log',
    icon: <BookOpen className="h-4 w-4" />,
    label: 'Libro de Guardia',
    roles: ['super_admin', 'admin', 'supervisor', 'guard'],
  },
  {
    to: '/sites',
    icon: <Building2 className="h-4 w-4" />,
    label: 'Objetivos',
    roles: ['super_admin', 'admin', 'supervisor'],
  },
  {
    to: '/personnel',
    icon: <Users className="h-4 w-4" />,
    label: 'Personal',
    roles: ['super_admin', 'admin', 'supervisor'],
  },
  {
    to: '/reports',
    icon: <FileText className="h-4 w-4" />,
    label: 'Informes',
    roles: ['super_admin', 'admin', 'supervisor', 'client'],
  },
]

export function Sidebar() {
  const { profile } = useAuthStore()
  const signOut = useSignOut()
  const location = useLocation()

  if (!profile) return null

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(profile.role))

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-white/8 bg-[#0a0a0a]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/20">
          <Shield className="h-4 w-4 text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-white tracking-wide">NexoGuard</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge ? (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/8 p-3 space-y-1">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors">
          <Bell className="h-4 w-4" />
          <span>Notificaciones</span>
        </button>
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback>{getInitials(profile.first_name, profile.last_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-[10px] text-zinc-500 capitalize">{profile.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={signOut}
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
