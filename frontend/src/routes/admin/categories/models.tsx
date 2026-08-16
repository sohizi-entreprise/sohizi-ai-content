import { createFileRoute } from '@tanstack/react-router'
import { ModelCategoriesPage } from '@/features/admin/components/model-categories-page'

export const Route = createFileRoute('/admin/categories/models')({
  component: ModelCategoriesPage,
})
