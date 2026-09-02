import { createFileRoute } from "@tanstack/react-router"
import { VendorsPage } from "@/features/admin/components/vendors-page"

export const Route = createFileRoute("/admin/vendors")({
  component: VendorsPage,
})
