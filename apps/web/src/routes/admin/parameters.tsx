import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/admin/parameters")({
  component: ParametersLayout,
})

function ParametersLayout() {
  return <Outlet />
}
