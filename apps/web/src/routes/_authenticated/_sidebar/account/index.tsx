import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/_sidebar/account/")({
  beforeLoad: () => {
    throw redirect({ to: "/account/profile" })
  },
  component: () => null,
})
