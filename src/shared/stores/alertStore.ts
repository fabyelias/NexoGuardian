import { create } from 'zustand'

export interface Alert {
  id: string
  type: 'panic' | 'incident' | 'info' | 'warning'
  title: string
  message: string
  incidentId?: string
  guardId?: string
  lat?: number | null
  lng?: number | null
  timestamp: string
  isAcknowledged: boolean
}

interface AlertState {
  alerts: Alert[]
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'isAcknowledged'>) => void
  acknowledgeAlert: (id: string) => void
  clearAlert: (id: string) => void
  clearAll: () => void
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        {
          ...alert,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          isAcknowledged: false,
        },
        ...state.alerts,
      ],
    })),
  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, isAcknowledged: true } : a)),
    })),
  clearAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
  clearAll: () => set({ alerts: [] }),
}))
