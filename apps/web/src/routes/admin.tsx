import {
  Link,
  Outlet,
  createFileRoute,
  useMatchRoute,
  useNavigate,
} from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@sohizi/ui/navigation-menu"
import type { CatalogSyncMode, CatalogSyncResult } from "@/features/admin/types"
import { syncAdminCatalogMutationOptions } from "@/features/admin/query-mutation"
import { useSession } from "@/lib/auth-client"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

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
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)

  useEffect(() => {
    if (isPending) return
    if (!session) {
      navigate({ to: "/sign-in" })
      return
    }
    if (session.user.type !== "admin") {
      navigate({ to: "/" })
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
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSyncDialogOpen(true)}
            >
              Sync catalog
            </Button>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Back to app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
      <CatalogSyncDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
      />
    </div>
  )
}

function CatalogSyncDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [result, setResult] = useState<CatalogSyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const syncMutation = useMutation(syncAdminCatalogMutationOptions())

  useEffect(() => {
    if (!open) return
    setResult(null)
    setError(null)
  }, [open])

  const handleSync = async (mode: CatalogSyncMode) => {
    if (
      mode === "overwrite" &&
      !window.confirm(
        "Overwrite catalog? This updates all catalog-owned fields from YAML and deletes stale rows (preserving enabled flags).",
      )
    ) {
      return
    }
    setError(null)
    setResult(null)
    try {
      const response = await syncMutation.mutateAsync(mode)
      setResult(response)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to sync catalog"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync catalog</DialogTitle>
          <DialogDescription>
            Sync categories, parameters, models, vendors, presets, and commands
            from the catalog YAML files into the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Populate</p>
              <p className="text-xs text-muted-foreground">
                Inserts missing rows from YAML and leaves existing records
                unchanged.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={syncMutation.isPending}
              onClick={() => handleSync("populate")}
            >
              {syncMutation.isPending && syncMutation.variables === "populate"
                ? "Populating…"
                : "Populate"}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Overwrite</p>
              <p className="text-xs text-muted-foreground">
                Updates all catalog-owned fields from YAML and removes stale
                rows. Preserves enabled toggles.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={syncMutation.isPending}
              onClick={() => handleSync("overwrite")}
            >
              {syncMutation.isPending && syncMutation.variables === "overwrite"
                ? "Overwriting…"
                : "Overwrite"}
            </Button>
          </div>

          {result ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              {result.mode === "overwrite"
                ? `Catalog overwrite completed (${result.removed} stale row${result.removed === 1 ? "" : "s"} removed).`
                : "Catalog populate completed."}
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive whitespace-pre-wrap">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <NavigationMenu viewport={false} className="max-w-none flex-none">
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
                <NavigationMenuLink asChild active={modelsActive}>
                  <Link to="/admin/categories/models">
                    <span className="font-medium">Models</span>
                    <span className="text-muted-foreground text-xs">
                      Catalog types for chat and media generation
                    </span>
                  </Link>
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink asChild active={contentActive}>
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
