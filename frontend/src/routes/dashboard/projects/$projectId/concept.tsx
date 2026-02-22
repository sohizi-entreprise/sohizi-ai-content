import ChooseConcept from '@/features/projects/pages/choose-concept'
import { getProjectQueryOptions } from '@/features/projects/query-mutation'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/projects/$projectId/concept')({
  loader: async ({ params, context }) => {
    const { projectId } = params
    context.queryClient.prefetchQuery(getProjectQueryOptions(projectId))
  },
  component: ChooseConcept,
})