import { useEffect, useRef } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'

const PUSH_INTERVAL_MS = 20_000   // push GPS every 20s
const MIN_DISTANCE_M   = 10       // also push if moved more than 10m

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Runs only for guards — continuously pushes GPS to guard_locations during active shift
export function useGuardLocationBroadcast() {
  const { profile } = useAuthStore()
  const lastPushed  = useRef<{ lat: number; lng: number; at: number } | null>(null)
  const shiftIdRef  = useRef<string | null>(null)
  const watchIdRef  = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const latestPos   = useRef<GeolocationCoordinates | null>(null)

  useEffect(() => {
    if (!profile || profile.role !== 'guard') return
    if (!navigator.geolocation) return

    async function resolveShift() {
      const { data } = await supabase
        .from('shifts')
        .select('id')
        .eq('guard_id', profile!.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      shiftIdRef.current = data?.id ?? null
    }

    async function pushLocation(coords: GeolocationCoordinates) {
      const { latitude: lat, longitude: lng, accuracy } = coords
      const now = Date.now()
      const prev = lastPushed.current

      const moved = prev
        ? haversineDistance(prev.lat, prev.lng, lat, lng) > MIN_DISTANCE_M
        : true
      const elapsed = prev ? now - prev.at > PUSH_INTERVAL_MS : true

      if (!moved && !elapsed) return

      lastPushed.current = { lat, lng, at: now }

      await supabase.from('guard_locations').insert({
        guard_id: profile!.id,
        shift_id: shiftIdRef.current,
        lat,
        lng,
        accuracy,
        is_online: true,
        recorded_at: new Date().toISOString(),
      })

      // Keep profile last_seen_at fresh
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', profile!.id)
    }

    resolveShift()

    // watchPosition fires on every significant GPS update
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        latestPos.current = pos.coords
        pushLocation(pos.coords)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    )

    // Fallback interval: push even if device didn't move
    intervalRef.current = setInterval(() => {
      if (latestPos.current) pushLocation(latestPos.current)
    }, PUSH_INTERVAL_MS)

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)

      // Mark offline on unmount
      if (lastPushed.current) {
        supabase.from('guard_locations').insert({
          guard_id: profile!.id,
          shift_id: shiftIdRef.current,
          lat: lastPushed.current.lat,
          lng: lastPushed.current.lng,
          is_online: false,
          recorded_at: new Date().toISOString(),
        })
      }
    }
  }, [profile?.id, profile?.role]) // eslint-disable-line react-hooks/exhaustive-deps
}
