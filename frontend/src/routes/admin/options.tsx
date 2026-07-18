import { createFileRoute } from '@tanstack/react-router'
import { OptionsPage } from '@/features/admin/components/options-page'

export const Route = createFileRoute('/admin/options')({
  component: OptionsPage,
})
