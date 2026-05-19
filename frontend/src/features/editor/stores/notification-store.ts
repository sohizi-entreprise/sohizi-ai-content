import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { GenerationRequestNotification } from '@/features/notifications/requests'

export type Notification = GenerationRequestNotification

type NotificationState = {
  notifications: Array<Notification>
}

type NotificationActions = {
  setNotifications: (notifications: Array<Notification>) => void
  upsertNotifications: (notifications: Array<Notification>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  getPendingRequestIds: () => Array<string>
}

const initialState: NotificationState = {
  notifications: [],
}

export const useNotificationStore = create<
  NotificationState & NotificationActions
>()(
  immer((set, get) => ({
    ...initialState,
    setNotifications: (notifications) => set({ notifications }),
    upsertNotifications: (notifications) =>
      set((state) => {
        for (const notification of notifications) {
          const index = state.notifications.findIndex(
            (item) => item.id === notification.id,
          )
          if (index === -1) {
            state.notifications.push(notification)
          } else {
            state.notifications[index] = notification
          }
        }
      }),
    removeNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter(
          (notification) => notification.id !== id,
        ),
      })),
    clearNotifications: () => set({ notifications: [] }),
    getPendingRequestIds: () => {
      return get()
        .notifications.filter(
          (notification) =>
            notification.status === 'pending' ||
            notification.status === 'processing',
        )
        .map((notification) => notification.id)
    },
  })),
)
