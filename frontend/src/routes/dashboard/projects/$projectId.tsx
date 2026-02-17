import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/projects/$projectId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
