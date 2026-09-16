import { createFileRoute } from "@tanstack/react-router"
import { AccountBillingPage } from "@/features/account/components/billing-page"

export const Route = createFileRoute(
  "/_authenticated/_sidebar/account/billing",
)({
  component: AccountBillingPage,
})
