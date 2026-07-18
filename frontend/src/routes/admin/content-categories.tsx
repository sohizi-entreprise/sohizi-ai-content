import { createFileRoute } from '@tanstack/react-router'
import { ContentCategoriesPage } from '@/features/admin/components/content-categories-page'

export const Route = createFileRoute('/admin/content-categories')({
  component: ContentCategoriesPage,
})
