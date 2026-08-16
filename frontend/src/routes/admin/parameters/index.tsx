import { createFileRoute } from '@tanstack/react-router'
import { ParametersPage } from '@/features/admin/components/parameters-page'

export const Route = createFileRoute('/admin/parameters/')({
  component: ParametersPage,
})
