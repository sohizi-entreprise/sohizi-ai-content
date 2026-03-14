import SynopsisPage from '@/features/projects/pages/synopsis'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/projects/$projectId/synopsis')(
  {
    component: SynopsisPage,
  },
)
