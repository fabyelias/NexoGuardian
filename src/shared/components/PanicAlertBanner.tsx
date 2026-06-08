import { Siren, MapPin, X, ExternalLink } from 'lucide-react'
import { useAlertStore } from '@/shared/stores/alertStore'
import { formatRelativeTime } from '@/shared/lib/utils'

export function PanicAlertBanner() {
  const alerts = useAlertStore((s) => s.alerts)
  const acknowledgeAlert = useAlertStore((s) => s.acknowledgeAlert)

  const panicAlerts = alerts.filter((a) => a.type === 'panic' && !a.isAcknowledged)

  if (panicAlerts.length === 0) return null

  return (
    <div className="relative z-40 flex flex-col gap-1">
      {panicAlerts.map((alert) => {
        const mapsUrl =
          alert.lat && alert.lng
            ? `https://www.google.com/maps?q=${alert.lat},${alert.lng}`
            : null

        return (
          <div
            key={alert.id}
            className="flex items-center gap-3 bg-red-600 px-4 py-3 animate-pulse"
          >
            <Siren className="h-5 w-5 text-white shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">
                {alert.title}
              </p>
              <p className="text-xs text-red-100 truncate">
                {alert.message} · {formatRelativeTime(alert.timestamp)}
              </p>
            </div>

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 rounded-md bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold text-white transition-colors shrink-0"
              >
                <MapPin className="h-3.5 w-3.5" />
                Ver ubicación
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {!mapsUrl && (
              <span className="flex items-center gap-1 text-xs text-red-200 shrink-0">
                <MapPin className="h-3.5 w-3.5" />
                Sin GPS
              </span>
            )}

            <button
              onClick={() => acknowledgeAlert(alert.id)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors shrink-0"
              aria-label="Reconocer alerta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
