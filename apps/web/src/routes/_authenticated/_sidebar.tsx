import { resetAnalyticsUser } from "@sohizi/analytics/browser"
import { useState } from "react"
import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router"
import { Menu } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@sohizi/ui/avatar"
import { Button } from "@sohizi/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sohizi/ui/dropdown-menu"
import {
  IconCirclePlusFilled,
  IconFolderFilled,
  IconLogout,
  IconSettingsFilled,
} from "@tabler/icons-react"
import { getInitials } from "@/features/account/lib"
import { authClient, useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/_sidebar")({
  component: RouteComponent,
})

const navigation = [
  {
    label: "My Projects",
    to: "/",
    icon: IconFolderFilled,
    isActive: (pathname: string) => pathname === "/",
  },
  {
    label: "Account Settings",
    to: "/account/profile",
    icon: IconSettingsFilled,
    isActive: (pathname: string) => pathname.startsWith("/account"),
  },
] as const

function RouteComponent() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const isProjects = pathname === "/"

  return (
    <div className="h-screen bg-background text-foreground md:flex font-geist">
      <aside className="hidden w-60 shrink-0 flex-col px-4 py-4 md:flex">
        <Link
          to="/"
          className="flex items-center gap-2"
          aria-label="Sohizi home"
        >
          <img
            src="/logo-monochrome-white.svg"
            alt=""
            className="size-8 object-contain relative -top-1"
          />
          <span className="text-base font-medium font-space-grotesk tracking-wide tex-foreground">
            Sohizi lab
          </span>
        </Link>

        <nav aria-label="Main navigation" className="mt-6 space-y-1">
          {navigation.map(({ label, to, icon: Icon, isActive }) => {
            const active = isActive(pathname)
            return (
              <Link
                key={label}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>
        <LogoutButton className="mt-auto" />
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto bg-card rounded-2xl mt-4 mr-4 relative">
        {isProjects && <GradientBackground />}
        <header className="flex h-16 sticky top-0 z-10 items-center justify-between backdrop-blur-sm px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 md:hidden">
                {navigation.map(({ label, to, icon: Icon, isActive }) => (
                  <DropdownMenuItem key={label} asChild>
                    <Link
                      to={to}
                      aria-current={isActive(pathname) ? "page" : undefined}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <LogoutMenuItem />
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              to="/"
              className="flex items-center gap-2 md:hidden"
              aria-label="Sohizi home"
            >
              <img src="/logo.svg" alt="" className="size-8 object-contain" />
              <span className="font-semibold tracking-tight">Sohizi Lab</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {isProjects && <StartProjectAction />}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function useSignOut() {
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await authClient.signOut()
    resetAnalyticsUser()
    navigate({ to: "/sign-in" })
  }

  return { signingOut, signOut }
}

function LogoutButton({ className }: { className?: string }) {
  const { data: session } = useSession()
  const { signingOut, signOut } = useSignOut()
  const user = session?.user

  return (
    <button
      type="button"
      disabled={signingOut}
      onClick={() => void signOut()}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-border px-2.5 py-2 text-sm font-medium transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
        className,
      )}
    >
      <Avatar>
        <AvatarImage src={user?.image ?? undefined} alt="" />
        <AvatarFallback className="text-xs">
          {getInitials(user?.name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-left">
        {signingOut ? "Signing out..." : "Log out"}
      </span>
      <IconLogout
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
  )
}

function LogoutMenuItem() {
  const { signingOut, signOut } = useSignOut()

  return (
    <DropdownMenuItem
      variant="destructive"
      disabled={signingOut}
      onClick={() => void signOut()}
    >
      <IconLogout className="size-4" aria-hidden="true" />
      {signingOut ? "Signing out..." : "Log out"}
    </DropdownMenuItem>
  )
}

function StartProjectAction() {
  return (
    <Button className="hidden sm:inline-flex rounded-xl font-bold cursor-pointer hover:scale-105 transition-transform duration-200">
      <IconCirclePlusFilled className="size-5" />
      New blank project
    </Button>
  )
}

function GradientBackground() {
  return (
    <>
      <div className="pointer-events-none absolute w-full h-1/2 inset-x-0 top-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.04)_1px,transparent_1px)] bg-size-[48px_48px] mask-[radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 h-85 w-160 bg-[radial-gradient(ellipse_at_top,oklch(0.936036_0.225167_121.2409/0.18),transparent_60%)] blur-[80px]" />
    </>
  )
}
