import { Outlet, useMatches } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useOnline } from '@/shared/hooks/useOnline'
import { WifiOff } from 'lucide-react'

export function AppShell() {
  const isOnline = useOnline()
  const matches = useMatches()
  const currentMatch = matches[matches.length - 1]
  const title = (currentMatch?.handle as { title?: string })?.title ?? 'NexoGuard'

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={title} />
        {!isOnline && (
          <div className="flex items-center gap-2 bg-amber-950/80 border-b border-amber-800/30 px-6 py-2 text-xs text-amber-400">
            <WifiOff className="h-3.5 w-3.5" />
            Sin conexión — los datos se sincronizarán automáticamente cuando vuelva el servicio.
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
