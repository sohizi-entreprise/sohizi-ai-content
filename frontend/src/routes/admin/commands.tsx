import { createFileRoute } from '@tanstack/react-router'
import { CommandsPage } from '@/features/admin/components/commands-page'

export const Route = createFileRoute('/admin/commands')({
  component: CommandsPage,
})
