import { createFileRoute } from '@tanstack/react-router'
import NewProject from '@/features/projects/pages/new-project'
import { getProjectOptionsQueryOptions } from '@/features/projects/query-mutation'

export const Route = createFileRoute('/dashboard/projects/new')({
  loader: async ({context}) => {
    context.queryClient.prefetchQuery(getProjectOptionsQueryOptions)
  },
  component: NewProject,
})
