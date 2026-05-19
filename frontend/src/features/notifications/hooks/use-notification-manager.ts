import { useEffect, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getPendingRequestsQueryOptions,
  getRequestStatusesMutationOptions,
} from '../query-mutations'
import { useNotificationStore } from '@/features/editor/stores/notification-store'

const POLLING_INTERVAL_MS = 2000
const MAX_POLLING_FAILURES = 5

export const useNotificationManager = (projectId: string) => {
  const setNotifications = useNotificationStore(
    (state) => state.setNotifications,
  )
  const upsertNotifications = useNotificationStore(
    (state) => state.upsertNotifications,
  )
  const notifications = useNotificationStore((state) => state.notifications)

  const { data: pendingRequests } = useQuery(
    getPendingRequestsQueryOptions(projectId),
  )
  const { mutateAsync: getRequestStatuses } = useMutation(
    getRequestStatusesMutationOptions(projectId),
  )

  const pendingRequestIds = useMemo(
    () =>
      notifications
        .filter(
          (notification) =>
            notification.status === 'pending' ||
            notification.status === 'processing',
        )
        .map((notification) => notification.id),
    [notifications],
  )
  const pendingRequestIdsKey = pendingRequestIds.join(',')

  useEffect(() => {
    if (pendingRequests) {
      setNotifications(pendingRequests)
    }
  }, [pendingRequests, setNotifications])

  useEffect(() => {
    const requestIds = pendingRequestIdsKey
      ? pendingRequestIdsKey.split(',')
      : []
    if (!projectId || requestIds.length === 0) return

    let cancelled = false
    let failureCount = 0

    const pollRequestStatuses = async () => {
      try {
        const statuses = await getRequestStatuses(requestIds)
        if (!cancelled) {
          failureCount = 0
          if (statuses.length === 0) {
            window.clearInterval(intervalId)
            return
          }
          upsertNotifications(statuses)
        }
      } catch (error) {
        if (!cancelled) {
          failureCount += 1
          console.error('Failed to poll notification statuses', error)
          if (failureCount >= MAX_POLLING_FAILURES) {
            window.clearInterval(intervalId)
          }
        }
      }
    }

    const intervalId = window.setInterval(() => {
      void pollRequestStatuses()
    }, POLLING_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [getRequestStatuses, pendingRequestIdsKey, projectId, upsertNotifications])
}
