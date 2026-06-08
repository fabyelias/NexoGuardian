import { Siren, MapPin, X, ExternalLink, Clock } from 'lucide-react'
import { useAlertStore } from '@/shared/stores/alertStore'
import { useAuthStore } from '@/shared/stores/authStore'
import { supabase } from '@/shared/lib/supabase'
import { formatRelativeTime } from '@/shared/lib/utils'

export function PanicAlertBanner() {
  const alerts = useAlertStore((s) => s.alerts)
  const acknowledgeAlert = useAlertStore((s) => s.acknowledgeAlert)
  const { profile } = useAuthStore()

  const panicAlerts = alerts.filter((a) => a.type === 'panic' && !a.isAcknowledged)

  if (panicAlerts.length === 0) return null

  async function handleAcknowledge(alertId: string, incidentId?: string) {
    acknowledgeAlert(alertId)

    // Persist to DB: mark the notification as read so admin can track who responded
    if (incidentId && profile) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('reference_id', incidentId)
        .eq('type', 'panic')
    }
  }

  return (
    <div className="relative z-40 flex flex-col">
      {panicAlerts.map((alert) => {
        const mapsUrl =
          alert.lat && alert.lng
            ? `https://www.google.com/maps?q=${alert.lat},${alert.lng}`
            : null

        return (
          <div
            key={alert.id}
            className="flex items-center gap-3 bg-red-600 px-3 py-2.5"
            style={{ animation: 'panicBlink 1.4s ease-in-out infinite' }}
          >
            <Siren className="h-5 w-5 text-white shrink-0 animate-bounce" />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white leading-tight tracking-wide">
                {alert.title}
              </p>
              <p className="text-xs text-red-100 truncate flex items-center gap-1.5">
                <Clock className="h-3 w-3 shrink-0" />
                {alert.message} · {formatRelativeTime(alert.timestamp)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 rounded-md bg-white/25 hover:bg-white/35 px-2.5 py-1.5 text-xs font-bold text-white transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ubicación</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-200">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sin GPS</span>
                </span>
              )}

              <button
                onClick={() => handleAcknowledge(alert.id, alert.incidentId)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 hover:bg-white/40 text-white transition-colors"
                title="Reconocer alerta"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      })}

      <style>{`
        @keyframes panicBlink {
          0%, 100% { background-color: #dc2626; }
          50%       { background-color: #b91c1c; }
        }
      `}</style>
    </div>
  )
}
