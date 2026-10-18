import { createFileRoute } from "@tanstack/react-router"
import { ErrorBoundary } from "react-error-boundary"
import { Suspense } from "react"
import { z } from "zod"
import { Separator } from "@sohizi/ui/separator"
import ListProjects, {
  ListProjectsError,
  ListProjectsSkeleton,
} from "@/features/projects/components/list-projects"
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
    <div className="space-y-16 py-12 sm:py-16 relative">
      <StartProject />
      <section className="space-y-6" aria-label="Projects">
        <div>
          <h2 className="text-3xl text-white font-semibold tracking-tight">
            Your projects
          </h2>
          <p className="mt-1 text-muted-foreground">
            Pick up where you left off.
          </p>
        </div>
        <Separator />
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
      </section>
    </div>
  )
}
