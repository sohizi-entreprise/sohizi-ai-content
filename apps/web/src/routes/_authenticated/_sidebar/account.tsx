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
  { label: "Billing", to: "/account/billing" },
  { label: "Cookies", to: "/account/cookies" },
] as const

function RouteComponent() {
  const pathname = useLocation({
    select: (location) => location.pathname,
  })

  return (
    <div className="account-dashboard mx-auto max-w-5xl space-y-8 py-8  sm:py-12">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Settings
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Account
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Manage your profile, workspace, and plan.
        </p>
      </div>

      <nav
        aria-label="Account settings"
        className="flex gap-1 overflow-x-auto border-b border-border pb-px sm:gap-3"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={pathname === tab.to ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
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
