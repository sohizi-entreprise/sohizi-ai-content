import { createFileRoute } from "@tanstack/react-router"
import { ErrorBoundary } from "react-error-boundary"
import { Suspense } from "react"
import { z } from "zod"
import ListProjects, {
  ListProjectsError,
  ListProjectsSkeleton,
} from "@/features/projects/components/list-projects"
import ProjectHeader from "@/features/projects/components/project-header"

export const Route = createFileRoute("/dashboard/main/projects")({
  validateSearch: z.object({
    display: z.enum(["list", "grid"]).optional().default("grid"),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="space-y-8">
      <ProjectHeader />
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary, error }) => (
          <ListProjectsError msg={error.message} reset={resetErrorBoundary} />
        )}
      >
        <Suspense fallback={<ListProjectsSkeleton />}>
          <ListProjects />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
