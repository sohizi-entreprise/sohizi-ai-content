import {
  Link,
  Outlet,
  createFileRoute,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@sohizi/ui/navigation-menu"

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
})

type AdminPath =
  | "/admin/models"
  | "/admin/parameters"
  | "/admin/vendors"
  | "/admin/commands"
  | "/admin/skills"
  | "/admin/categories/models"
  | "/admin/categories/content"

function AdminLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (isPending) return
    if (!session) {
      navigate({ to: "/sign-in" })
      return
    }
    if (session.user.type !== "admin") {
      navigate({ to: "/dashboard/main/projects" })
    }
  }, [session, isPending, navigate])

  if (isPending || !session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (session.user.type !== "admin") {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              to="/admin/models"
              className="text-lg font-semibold tracking-tight"
            >
              Admin
            </Link>
            <nav className="flex flex-wrap items-center gap-1">
              <AdminNavLink to="/admin/models">Models</AdminNavLink>
              <AdminNavLink to="/admin/parameters">Parameters</AdminNavLink>
              <AdminNavLink to="/admin/vendors">Vendors</AdminNavLink>
              <AdminNavLink to="/admin/commands">Commands</AdminNavLink>
              <AdminNavLink to="/admin/skills">Skills</AdminNavLink>
              <CategoriesNavMenu />
            </nav>
          </div>
          <Link
            to="/dashboard/main/projects"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function AdminNavLink({
  to,
  children,
}: {
  to: AdminPath
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
      activeProps={{
        className: cn(
          "rounded-md px-3 py-1.5 text-sm transition bg-muted text-foreground",
        ),
      }}
    >
      {children}
    </Link>
  )
}

function CategoriesNavMenu() {
  const matchRoute = useMatchRoute()
  const modelsActive = Boolean(
    matchRoute({ to: "/admin/categories/models", fuzzy: false }),
  )
  const contentActive = Boolean(
    matchRoute({ to: "/admin/categories/content", fuzzy: false }),
  )
  const categoriesActive = modelsActive || contentActive

  return (
    <NavigationMenu
      viewport={false}
      className="max-w-none flex-none"
    >
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              "h-auto bg-transparent px-3 py-1.5 text-sm font-normal text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground",
              categoriesActive && "bg-muted text-foreground",
            )}
          >
            Categories
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[280px] gap-1 p-1">
              <li>
                <NavigationMenuLink
                  asChild
                  active={modelsActive}
                >
                  <Link to="/admin/categories/models">
                    <span className="font-medium">Models</span>
                    <span className="text-muted-foreground text-xs">
                      Catalog types for chat and media generation
                    </span>
                  </Link>
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink
                  asChild
                  active={contentActive}
                >
                  <Link to="/admin/categories/content">
                    <span className="font-medium">Content</span>
                    <span className="text-muted-foreground text-xs">
                      Taxonomy for skills, projects, and more
                    </span>
                  </Link>
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}
