import { createFileRoute } from "@tanstack/react-router"
import { SkillsPage } from "@/features/admin/components/skills-page"

export const Route = createFileRoute("/admin/skills")({
  component: SkillsPage,
})
