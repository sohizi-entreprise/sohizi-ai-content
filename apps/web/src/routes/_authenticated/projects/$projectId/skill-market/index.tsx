import { createFileRoute } from "@tanstack/react-router"
import { SkillMarketListPage } from "@/features/skill-market"

export const Route = createFileRoute(
  "/_authenticated/projects/$projectId/skill-market/",
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <SkillMarketListPage />
}
