import { createFileRoute } from "@tanstack/react-router"
import { AccountOrganizationPage } from "@/features/account/components/organization-page"

export const Route = createFileRoute(
  "/_authenticated/_sidebar/account/organization",
)({
  component: AccountOrganizationPage,
})
