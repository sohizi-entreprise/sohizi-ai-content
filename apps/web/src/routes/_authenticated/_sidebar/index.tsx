import { createFileRoute } from "@tanstack/react-router"
import { ErrorBoundary } from "react-error-boundary"
import { Suspense } from "react"
import { z } from "zod"
import { Separator } from "@sohizi/ui/separator"
import ListProjects, {
  ListProjectsError,
  ListProjectsSkeleton,
} from "@/features/projects/components/list-projects"
import ProjectHeader from "@/features/projects/components/project-header"
import StartProject from "@/features/projects/pages/start-project"
import { reportBrowserError } from "@/lib/sentry-client"

export const Route = createFileRoute("/_authenticated/_sidebar/")({
  validateSearch: z.object({
    display: z.enum(["list", "grid"]).optional().default("grid"),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="space-y-8 py-10">
      <StartProject />
      <Separator className="mt-20" />
      <ProjectHeader />
      <ErrorBoundary
        onError={reportBrowserError}
        fallbackRender={({ resetErrorBoundary, error }) => (
          <ListProjectsError
            msg={error instanceof Error ? error.message : "Unknown error"}
            reset={resetErrorBoundary}
          />
        )}
      >
        <Suspense fallback={<ListProjectsSkeleton />}>
          <ListProjects />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
