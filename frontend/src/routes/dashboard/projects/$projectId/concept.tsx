import ChooseConcept from '@/features/projects/pages/choose-concept'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/projects/$projectId/concept')({
  component: ChooseConcept,
})