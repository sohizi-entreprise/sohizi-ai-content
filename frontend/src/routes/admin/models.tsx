import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/models')({
  component: ModelsLayout,
})

function ModelsLayout() {
  return <Outlet />
}
