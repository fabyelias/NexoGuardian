import { useState, useEffect, useCallback } from 'react'

interface GPSPosition {
  lat: number
  lng: number
  accuracy: number
}

interface GPSState {
  position: GPSPosition | null
  error: string | null
  isLoading: boolean
}

export function useGPS(watch = false) {
  const [state, setState] = useState<GPSState>({
    position: null,
    error: null,
    isLoading: false,
  })

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    setState({
      position: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      },
      error: null,
      isLoading: false,
    })
  }, [])

  const onError = useCallback((err: GeolocationPositionError) => {
    setState((prev) => ({ ...prev, error: err.message, isLoading: false }))
  }, [])

  const requestPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: 'Geolocalización no disponible', isLoading: false }))
      return
    }
    setState((prev) => ({ ...prev, isLoading: true }))
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    })
  }, [onSuccess, onError])

  useEffect(() => {
    if (!watch) return
    if (!navigator.geolocation) return

    setState((prev) => ({ ...prev, isLoading: true }))
    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    })

    return () => navigator.geolocation.clearWatch(watchId)
  }, [watch, onSuccess, onError])

  return { ...state, requestPosition }
}
