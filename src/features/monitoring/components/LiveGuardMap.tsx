import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Marker, DivIcon } from 'leaflet'
import type { GuardLocation, Profile } from '@/shared/types/models'

interface GuardPin {
  guard: Profile
  location: GuardLocation
  isPanic?: boolean
}

interface LiveGuardMapProps {
  pins: GuardPin[]
  center?: [number, number]
  height?: string
}

function makeIcon(guard: Profile, isPanic: boolean, L: typeof import('leaflet')): DivIcon {
  const initials = `${guard.first_name[0]}${guard.last_name[0]}`.toUpperCase()
  const bg = isPanic ? '#dc2626' : '#2563eb'
  const pulse = isPanic
    ? `<span style="position:absolute;inset:0;border-radius:50%;background:${bg};opacity:.4;animation:ping 1s cubic-bezier(0,0,.2,1) infinite"></span>`
    : ''

  return L.divIcon({
    className: '',
    iconSize: [40, 52],
    iconAnchor: [20, 52],
    popupAnchor: [0, -54],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center">
        ${pulse}
        <div style="position:relative;z-index:1;width:36px;height:36px;border-radius:50%;background:${bg};
          border:3px solid white;display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,.5);font-size:12px;font-weight:700;color:white;font-family:sans-serif">
          ${initials}
        </div>
        <div style="position:relative;z-index:1;width:0;height:0;
          border-left:7px solid transparent;border-right:7px solid transparent;
          border-top:10px solid ${bg};margin-top:-2px"></div>
      </div>
    `,
  })
}

export function LiveGuardMap({ pins, center, height = '320px' }: LiveGuardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<LeafletMap | null>(null)
  const markersRef   = useRef<Map<string, Marker>>(new Map())

  // Bootstrap Leaflet once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then((L) => {
      // Inject Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id   = 'leaflet-css'
        link.rel  = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      // Inject ping keyframe animation
      if (!document.getElementById('pin-pulse-style')) {
        const style = document.createElement('style')
        style.id = 'pin-pulse-style'
        style.textContent = `@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`
        document.head.appendChild(style)
      }

      const map = L.map(containerRef.current!, {
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      // Initial fit / center
      if (pins.length > 0) {
        const latlngs = pins.map((p) => [p.location.lat, p.location.lng] as [number, number])
        if (latlngs.length === 1) {
          map.setView(latlngs[0], 16)
        } else {
          map.fitBounds(latlngs, { padding: [40, 40] })
        }
      } else if (center) {
        map.setView(center, 14)
      } else {
        map.setView([-34.6037, -58.3816], 12) // Buenos Aires default
      }
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current.clear()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when pins change
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then((L) => {
      const map = mapRef.current!
      const existing = markersRef.current
      const seen = new Set<string>()

      for (const { guard, location, isPanic } of pins) {
        seen.add(guard.id)
        const latlng: [number, number] = [location.lat, location.lng]
        const icon = makeIcon(guard, !!isPanic, L)
        const popup = `
          <div style="font-family:sans-serif;min-width:160px">
            <p style="font-weight:700;margin:0 0 4px;font-size:13px">${guard.first_name} ${guard.last_name}</p>
            ${guard.badge_number ? `<p style="margin:0 0 2px;font-size:11px;color:#666">Legajo: ${guard.badge_number}</p>` : ''}
            <p style="margin:0 0 2px;font-size:11px;color:#666">
              ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}
            </p>
            <a href="https://www.google.com/maps?q=${location.lat},${location.lng}" target="_blank"
              style="font-size:11px;color:#2563eb">Ver en Google Maps →</a>
          </div>
        `

        if (existing.has(guard.id)) {
          const marker = existing.get(guard.id)!
          marker.setLatLng(latlng)
          marker.setIcon(icon)
          marker.getPopup()?.setContent(popup)
        } else {
          const marker = L.marker(latlng, { icon })
            .addTo(map)
            .bindPopup(popup)
          existing.set(guard.id, marker)
        }
      }

      // Remove markers for guards no longer in pins
      for (const [id, marker] of existing) {
        if (!seen.has(id)) {
          marker.remove()
          existing.delete(id)
        }
      }
    })
  }, [pins])

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }}
      className="border border-white/8"
    />
  )
}
