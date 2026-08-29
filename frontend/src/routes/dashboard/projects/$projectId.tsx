import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppHeader } from '@/components/layout/app-header'
import { AppNavBar } from '@/components/layout/app-nav-bar'

export const Route = createFileRoute('/dashboard/projects/$projectId')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background pr-2">
      <AppHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppNavBar />
        <Outlet />
      </div>
    </div>
  )
}
