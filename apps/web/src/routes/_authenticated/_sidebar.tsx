import { resetAnalyticsUser } from "@sohizi/analytics/browser"
import { useState } from "react"
import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router"
import { Avatar, AvatarFallback, AvatarImage } from "@sohizi/ui/avatar"
import { Button } from "@sohizi/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sohizi/ui/dropdown-menu"
import Container from "@/components/layout/container"
import { getInitials } from "@/features/account/lib"
import { authClient, useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/_sidebar")({
  component: RouteComponent,
})

function RouteComponent() {
  const activeLinkClass = "text-primary font-medium"
  const pathname = useLocation({
    select: (location) => location.pathname,
  })

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/logo.svg"
            alt=""
            width={32}
            height={28}
            className="h-7 w-8 shrink-0 object-contain sm:h-8 sm:w-9 -mt-2"
          />
          {/* <span className="font-bold">Sohizi Lab</span> */}
        </div>

        <Container>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className={cn(
                "text-muted-foreground cursor-pointer hover:text-foreground transition-colors",
                pathname === "/" && activeLinkClass,
              )}
            >
              Home
            </Link>
          </div>
        </Container>

        <AvatarDropdown />
      </div>
      {/* --- */}

      <div className="flex-1 overflow-y-auto">
        <Container>
          <Outlet />
        </Container>
      </div>
    </div>
  )
}

function AvatarDropdown() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const user = session?.user

  const handleSignOut = async () => {
    setSigningOut(true)
    await authClient.signOut()
    resetAnalyticsUser()
    navigate({ to: "/sign-in" })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar>
            <AvatarImage
              src={user?.image ?? undefined}
              alt={user?.name || "Account"}
            />
            <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">
            {user?.name || "Unnamed"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user?.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/account/profile">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/billing">Billing</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/organization">Organization</Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
        >
          {signingOut ? "Signing out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
