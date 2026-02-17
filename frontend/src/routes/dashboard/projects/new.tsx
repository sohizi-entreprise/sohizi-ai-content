import { createFileRoute } from '@tanstack/react-router'
import NewProject from '@/features/projects/pages/new-project'

export const Route = createFileRoute('/dashboard/projects/new')({
  component: NewProject,
})
