import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { RoutePending } from "@/components/layout/route-pending"

export const Route = createFileRoute(
  "/_authenticated/projects/$projectId/skill-market/",
)({
  ssr: false,
  pendingComponent: () => <RoutePending label="Loading skill market..." />,
  component: lazyRouteComponent(
    () => import("@/features/skill-market"),
    "SkillMarketListPage",
  ),
})
