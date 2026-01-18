import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
  errorComponent: ({error}) => <div>Error loading dashboard: {error.message}</div>,
})

function RouteComponent() {
  return (
    <div>
        <Outlet />
    </div>
  )
}
