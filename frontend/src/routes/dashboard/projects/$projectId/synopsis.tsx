import ValidateSynopsis from '@/features/projects/pages/validate-synopsis'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/projects/$projectId/synopsis')(
  {
    component: ValidateSynopsis,
  },
)
