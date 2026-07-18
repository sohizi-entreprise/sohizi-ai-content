import { createFileRoute } from '@tanstack/react-router'
import { ModelsPage } from '@/features/admin/components/models-page'

export const Route = createFileRoute('/admin/models')({
  component: ModelsPage,
})
