import { createFileRoute, redirect } from "@tanstack/react-router"
import { siteUrl } from "@/lib/site-url"

export const Route = createFileRoute("/pricing")({
  beforeLoad: () => {
    throw redirect({ href: siteUrl("/pricing") })
  },
})
