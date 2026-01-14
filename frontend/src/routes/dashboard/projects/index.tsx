import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import DashboardHeader from '@/components/layout/dashboard-header'
import ListProjects, { ListProjectsError, ListProjectsSkeleton } from '@/features/projects/components/list-projects'
import { listProjectsQueryOptions } from '@/features/projects/query-mutation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'


export const Route = createFileRoute('/dashboard/projects/')({
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(listProjectsQueryOptions)
  },
  component: ProjectsPage,
})


function ProjectsPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20 pt-header">
      {/* Header */}
      <DashboardHeader leftSide={<span className="font-display text-xl font-semibold tracking-tight">Sohizi</span>}
                        rightSide={
                          <Link to="/dashboard/projects/new">
                            <Button className="gap-2 bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">
                              <Plus className="h-4 w-4" />
                              New Project
                            </Button>
                          </Link>
                        }
      />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold tracking-tight">Projects</h1>
          <p className="mt-2 text-muted-foreground">
            Create and manage your video storyboards
          </p>
        </div>
        <ErrorBoundary fallbackRender={({resetErrorBoundary}) => <ListProjectsError msg="Failed to load projects" reset={resetErrorBoundary} />}>
          <Suspense fallback={<ListProjectsSkeleton />}>
            <ListProjects />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

