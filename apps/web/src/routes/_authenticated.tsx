import {
  captureAnalyticsEvent,
  identifyAnalyticsUser,
} from "@sohizi/analytics/browser"
import { useAnalyticsConsent } from "@sohizi/analytics/consent"
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import {
  reportBrowserError,
  reportServerBoundaryError,
} from "@/lib/sentry-client"
import { OrgSetupModal } from "@/features/account/components/org-setup-modal"
import { authClient, organization, useSession } from "@/lib/auth-client"

export const Route = createFileRoute("/_authenticated")({
  component: RouteComponent,
  errorComponent: ({ error }) => <DashboardError error={error} />,
})

function DashboardError({ error }: { error: Error }) {
  reportServerBoundaryError(error)
  useEffect(() => reportBrowserError(error), [error])
  return <div>Error loading dashboard: {error.message}</div>
}

function RouteComponent() {
  const { data: session, isPending, refetch } = useSession()
  const [orgReady, setOrgReady] = useState(false)
  const [showOrgModal, setShowOrgModal] = useState(false)
  const navigate = useNavigate()
  const userId = session?.user.id
  const { choice } = useAnalyticsConsent()

  useEffect(() => {
    if (!userId || choice !== "accepted") return
    identifyAnalyticsUser(userId)
    if (sessionStorage.getItem("sohizi_google_signup_pending") === "1") {
      sessionStorage.removeItem("sohizi_google_signup_pending")
      const createdAt = session.user.createdAt
      if (Date.now() - new Date(createdAt).getTime() < 120_000) {
        captureAnalyticsEvent("signup_completed", { method: "google" })
      }
    }
  }, [userId, choice, session?.user.createdAt])

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
