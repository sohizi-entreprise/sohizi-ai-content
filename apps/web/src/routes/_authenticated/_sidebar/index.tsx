import { createFileRoute } from "@tanstack/react-router"
import { ErrorBoundary } from "react-error-boundary"
import { Suspense } from "react"
import { z } from "zod"
import ListProjects, {
  ListProjectsError,
  ListProjectsSkeleton,
} from "@/features/projects/components/list-projects"
import { reportBrowserError } from "@/lib/sentry-client"

export const Route = createFileRoute("/_authenticated/_sidebar/")({
  validateSearch: z.object({
    display: z.enum(["list", "grid"]).optional().default("grid"),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="pt-10 pb-12 sm:pt-12 sm:pb-16 relative">
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
