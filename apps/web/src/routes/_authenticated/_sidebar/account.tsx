import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
} from "@tanstack/react-router"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/_sidebar/account")({
  component: RouteComponent,
})

const tabs = [
  { label: "Profile", to: "/account/profile" },
  { label: "Organization", to: "/account/organization" },
  { label: "Billing", to: "/account/billing" },
] as const

function RouteComponent() {
  const pathname = useLocation({
    select: (location) => location.pathname,
  })

  return (
    <div className="space-y-8 py-8 font-space-grotesk">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your profile, workspace, and plan.
        </p>
      </div>

      <nav className="flex gap-2 border-b border-white/10 pb-px">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              pathname === tab.to
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
