import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { RoutePending } from "@/components/layout/route-pending"

export const Route = createFileRoute(
  "/_authenticated/projects/$projectId/editor",
)({
  ssr: false,
  pendingComponent: () => <RoutePending />,
  component: lazyRouteComponent(
    () => import("@/features/editor"),
    "VideoProductionEditor",
  ),
})
