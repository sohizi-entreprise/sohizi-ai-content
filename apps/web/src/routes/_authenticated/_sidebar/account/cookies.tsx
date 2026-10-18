import { createFileRoute } from "@tanstack/react-router"
import { AccountCookiesPage } from "@/features/account/components/cookies-page"

export const Route = createFileRoute(
  "/_authenticated/_sidebar/account/cookies",
)({
  component: AccountCookiesPage,
})
