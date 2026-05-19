import { mutationOptions, queryOptions } from '@tanstack/react-query'
import { getPendingRequests, getRequestStatuses } from './requests'

export const notificationKeys = {
  pendingRequests: (projectId: string) => [
    'project',
    projectId,
    'notifications',
    'pending-requests',
  ],
  requestStatuses: (projectId: string) => [
    'project',
    projectId,
    'notifications',
    'request-statuses',
  ],
}

export const getPendingRequestsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: notificationKeys.pendingRequests(projectId),
    queryFn: () => getPendingRequests(projectId),
    enabled: !!projectId,
  })

export const getRequestStatusesMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (requestIds: Array<string>) =>
      getRequestStatuses(projectId, requestIds),
  })
