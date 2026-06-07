import { useEffect } from 'react'
import { useOfflineStore } from '@/shared/stores/offlineStore'

export function useOnline() {
  const { isOnline, setOnline } = useOfflineStore()

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])

  return isOnline
}
