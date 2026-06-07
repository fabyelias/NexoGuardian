import { useState, useEffect } from 'react'
import { Outlet, useLocation, useMatches } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useOnline } from '@/shared/hooks/useOnline'
import { WifiOff } from 'lucide-react'

export function AppShell() {
  const isOnline = useOnline()
  const matches = useMatches()
  const location = useLocation()
  const currentMatch = matches[matches.length - 1]
  const title = (currentMatch?.handle as { title?: string })?.title ?? 'NexoGuard'

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
        {!isOnline && (
          <div className="flex items-center gap-2 bg-amber-950/80 border-b border-amber-800/30 px-4 py-2 text-xs text-amber-400">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            Sin conexión — los datos se sincronizarán cuando vuelva el servicio.
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
