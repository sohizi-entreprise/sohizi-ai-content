import { createFileRoute, redirect } from "@tanstack/react-router"
import { siteUrl } from "@/lib/site-url"

export const Route = createFileRoute("/terms")({
  beforeLoad: () => {
    throw redirect({ href: siteUrl("/terms") })
  },
})
