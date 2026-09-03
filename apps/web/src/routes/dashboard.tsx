import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { authClient, organization, useSession } from "@/lib/auth-client"
import { Button } from "@sohizi/ui/button"
import { Spinner } from "@sohizi/ui/spinner"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  errorComponent: ({ error }) => (
    <div>Error loading dashboard: {error.message}</div>
  ),
})

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}

function RouteComponent() {
  const { data: session, isPending, refetch } = useSession()
  const [orgReady, setOrgReady] = useState(false)
  const [showOrgModal, setShowOrgModal] = useState(false)
  const navigate = useNavigate()
  const userId = session?.user.id

  useEffect(() => {
    setOrgReady(false)
  }, [userId])

  useEffect(() => {
    if (isPending) return

    if (!session) {
      navigate({ to: "/sign-in" })
      return
    }

    let cancelled = false

    authClient.organization.list().then(async ({ data }) => {
      if (cancelled) return

      if (!data || data.length === 0) {
        setShowOrgModal(true)
      } else if (!session.session.activeOrganizationId) {
        await organization.setActive({ organizationId: data[0].id })
        await refetch()
      }

      setOrgReady(true)
    })

    return () => {
      cancelled = true
    }
    // session intentionally omitted — bootstrap runs per userId, not on session refetch
  }, [userId, isPending, navigate, refetch])

  if (isPending && !session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="relative h-full">
      <Outlet />
      {!orgReady && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )}
      <OrgSetupModal
        open={showOrgModal}
        onCreated={async () => {
          await refetch()
          setShowOrgModal(false)
        }}
      />
    </div>
  )
}

function OrgSetupModal({
  open,
  onCreated,
}: {
  open: boolean
  onCreated: () => void | Promise<void>
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const slug = toSlug(name)
    const { data: orgData, error: orgError } = await organization.create({
      name,
      slug,
    })

    if (orgError) {
      setError(orgError.message || "Failed to create organization")
      setLoading(false)
      return
    }

    await organization.setActive({ organizationId: orgData.id })
    await onCreated()

    setLoading(false)
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Name Your Organization</DialogTitle>
          <DialogDescription>
            This is your workspace where you'll create and manage projects.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleCreateOrg}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              type="text"
              placeholder="My Studio"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            {name && (
              <p className="text-xs text-muted-foreground">
                Slug: {toSlug(name)}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !name.trim()}
          >
            {loading && <Spinner />}
            {loading ? "Creating..." : "Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
