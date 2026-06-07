import { Bell, Wifi, WifiOff, Menu } from 'lucide-react'
import { useOnline } from '@/shared/hooks/useOnline'
import { useAlertStore } from '@/shared/stores/alertStore'
import { cn } from '@/shared/lib/utils'

interface TopBarProps {
  title?: string
  onMenuClick?: () => void
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  const isOnline = useOnline()
  const alerts = useAlertStore((s) => s.alerts)
  const unreadCount = alerts.filter((a) => !a.isAcknowledged).length

  return (
    <header className="flex h-14 items-center justify-between border-b border-white/8 bg-[#0a0a0a]/80 backdrop-blur-sm px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Connectivity — text hidden on mobile */}
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          isOnline
            ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/30'
            : 'bg-red-950/50 text-red-400 border border-red-800/30'
        )}>
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span className="hidden sm:inline">{isOnline ? 'En línea' : 'Sin conexión'}</span>
        </div>

        {/* Notifications */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
