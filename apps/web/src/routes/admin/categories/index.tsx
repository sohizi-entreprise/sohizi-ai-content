import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/categories/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/categories/content" })
  },
})
