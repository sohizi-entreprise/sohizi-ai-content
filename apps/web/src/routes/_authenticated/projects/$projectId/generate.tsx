import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { RoutePending } from "@/components/layout/route-pending"

export const Route = createFileRoute(
  "/_authenticated/projects/$projectId/generate",
)({
  ssr: false,
  pendingComponent: () => <RoutePending label="Loading generator..." />,
  component: lazyRouteComponent(() =>
    import("./-generate-page").then((module) => ({
      default: module.GeneratePage,
    })),
  ),
})
