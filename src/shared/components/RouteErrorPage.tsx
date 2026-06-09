import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export function RouteErrorPage() {
  const error     = useRouteError()
  const navigate  = useNavigate()

  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Error inesperado'

  // Leaflet DOM conflicts are harmless display glitches — auto-recover
  const isLeafletGlitch =
    message.toLowerCase().includes('insertbefore') ||
    message.toLowerCase().includes('is not a child')

  if (isLeafletGlitch) {
    // Silently go back to last page
    navigate(-1)
    return null
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-5 bg-[#0a0a0a] px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-800/40 bg-red-950/30">
        <AlertTriangle className="h-7 w-7 text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-white">Algo salió mal</p>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-500">{message}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Reintentar
        </button>
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm text-white transition-colors"
        >
          <Home className="h-4 w-4" /> Ir al inicio
        </button>
      </div>
    </div>
  )
}
