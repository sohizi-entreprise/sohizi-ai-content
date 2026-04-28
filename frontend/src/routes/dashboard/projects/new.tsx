import { createFileRoute } from '@tanstack/react-router'
import { getProjectOptionsQueryOptions } from '@/features/projects/query-mutation'
import StartProject from '@/features/projects/pages/start-project'

export const Route = createFileRoute('/dashboard/projects/new')({
  loader: async ({context}) => {
    context.queryClient.prefetchQuery(getProjectOptionsQueryOptions)
  },
  component: StartProject,
})
