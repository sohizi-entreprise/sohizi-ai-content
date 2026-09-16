import { createFileRoute } from "@tanstack/react-router"
import { AccountProfilePage } from "@/features/account/components/profile-page"

export const Route = createFileRoute(
  "/_authenticated/_sidebar/account/profile",
)({
  component: AccountProfilePage,
})
