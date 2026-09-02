import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/content-categories")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/categories/content" })
  },
})
