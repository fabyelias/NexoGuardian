import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OfflineAction {
  id: string
  type: 'create_log' | 'create_incident' | 'add_patrol_point' | 'update_location'
  payload: Record<string, unknown>
  createdAt: string
  retries: number
}

interface OfflineState {
  isOnline: boolean
  queue: OfflineAction[]
  setOnline: (online: boolean) => void
  enqueue: (action: Omit<OfflineAction, 'id' | 'createdAt' | 'retries'>) => void
  dequeue: (id: string) => void
  clearQueue: () => void
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      isOnline: navigator.onLine,
      queue: [],
      setOnline: (isOnline) => set({ isOnline }),
      enqueue: (action) =>
        set((state) => ({
          queue: [
            ...state.queue,
            {
              ...action,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              retries: 0,
            },
          ],
        })),
      dequeue: (id) =>
        set((state) => ({ queue: state.queue.filter((a) => a.id !== id) })),
      clearQueue: () => set({ queue: [] }),
    }),
    { name: 'nexoguard-offline-queue' }
  )
)
