import { resetAnalyticsUser } from "@sohizi/analytics/browser"
import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@sohizi/ui/button"
import { Card, CardContent } from "@sohizi/ui/card"
import { Spinner } from "@sohizi/ui/spinner"
import { Check, LogOut } from "lucide-react"
import { getInitials } from "../lib"
import { authClient, organization, useSession } from "@/lib/auth-client"

type Organization = {
  id: string
  name: string
  slug: string
}

export function AccountProfilePage() {
  const { data: session, refetch } = useSession()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<Array<Organization>>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const user = session?.user
  const activeOrganizationId = session?.session.activeOrganizationId

  useEffect(() => {
    void organization.list().then(({ data }) => {
      setOrgs(data ?? [])
      setLoadingOrgs(false)
    })
  }, [])

  const handleSwitch = async (organizationId: string) => {
    setSwitchingId(organizationId)
    await organization.setActive({ organizationId })
    await refetch()
    setSwitchingId(null)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await authClient.signOut()
    resetAnalyticsUser()
    navigate({ to: "/sign-in" })
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your account? This permanently deletes your account and any workspace where you are the only member, including its projects and subscription. This cannot be undone.",
    )
    if (!confirmed) return
    setDeleting(true)
    setDeleteError(null)
    const { error } = await authClient.deleteUser()
    if (error) {
      setDeleteError(error.message || "Could not delete your account.")
      setDeleting(false)
      return
    }
    resetAnalyticsUser()
    navigate({ to: "/sign-in" })
  }

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card className="overflow-hidden bg-white/5! border-none pt-0">
        <div className="relative overflow-hidden h-24 w-full">
          <img
            src="/green-bg-2.avif"
            alt=""
            className="absolute inset-0 object-cover w-full"
          />
          {/* <div className="absolute inset-0 bg-[radial-gradient(60%_120%_at_15%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]" /> */}
        </div>
        <CardContent className="-mt-12 space-y-5">
          <div className="flex items-end gap-4">
            <div className="relative z-10 flex size-20 shrink-0 items-center justify-center rounded-full bg-card border border-border text-2xl font-bold text-primary shadow-primary">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0 pb-1">
              <h2 className="truncate text-xl font-semibold tracking-tight">
                {user?.name || "Unnamed"}
              </h2>
              <p className="truncate text-sm text-muted-foreground">
                {user?.email}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="cursor-pointer border-white/20! rounded-full hover:scale-105 transition-transform duration-200 ml-auto"
            >
              {signingOut ? <Spinner /> : <LogOut />}
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Organizations */}
      <Card className="bg-white/5! border-none">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-semibold tracking-tight">Organization</h3>
            <p className="text-sm text-muted-foreground">
              Workspaces you belong to
            </p>
          </div>

          {loadingOrgs ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading organizations...
            </div>
          ) : orgs.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              You don&apos;t belong to an organization yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {orgs.map((org) => {
                const isActive = org.id === activeOrganizationId
                return (
                  <li
                    key={org.id}
                    // data-active={isActive || undefined}
                    className="flex items-center justify-between gap-4 rounded-xl bg-card/80 p-3 transition-colors data-active:bg-primary/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-background">
                        {getInitials(org.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {org.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {org.slug}
                        </p>
                      </div>
                    </div>
                    {isActive ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                        <Check className="size-3.5" />
                        Active
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={switchingId === org.id}
                        onClick={() => void handleSwitch(org.id)}
                      >
                        {switchingId === org.id && <Spinner />}
                        {switchingId === org.id ? "Switching..." : "Switch"}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5! border-none">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-semibold tracking-tight">Delete account</h3>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and any workspace where you are
              the only member.
            </p>
          </div>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => void handleDeleteAccount()}
            disabled={deleting}
            className="cursor-pointer"
          >
            {deleting ? <Spinner /> : null}
            {deleting ? "Deleting..." : "Delete account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
