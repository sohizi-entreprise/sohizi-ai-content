import { useEffect, useState } from "react"
import { Button } from "@sohizi/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sohizi/ui/card"
import { Spinner } from "@sohizi/ui/spinner"
import { OrgSetupModal } from "./org-setup-modal"
import { organization, useSession } from "@/lib/auth-client"

type Organization = {
  id: string
  name: string
  slug: string
}

export function AccountOrganizationPage() {
  const { data: session, refetch } = useSession()
  const [orgs, setOrgs] = useState<Array<Organization>>([])
  const [loading, setLoading] = useState(true)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const activeOrganizationId = session?.session.activeOrganizationId

  const loadOrgs = async () => {
    const { data } = await organization.list()
    setOrgs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void loadOrgs()
  }, [])

  const handleSwitch = async (organizationId: string) => {
    setSwitchingId(organizationId)
    await organization.setActive({ organizationId })
    await refetch()
    setSwitchingId(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Switch workspaces or create a new one
          </CardDescription>
          <CardAction>
            <Button onClick={() => setCreateOpen(true)}>
              New organization
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Loading organizations...
            </div>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have an organization yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {orgs.map((org) => {
                const isActive = org.id === activeOrganizationId
                return (
                  <li
                    key={org.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{org.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {org.slug}
                      </p>
                    </div>
                    {isActive ? (
                      <span className="text-xs font-semibold uppercase text-primary">
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

      <OrgSetupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        showCloseButton
        title="Create organization"
        description="Create another workspace to manage projects separately."
        submitLabel="Create"
        onCreated={async () => {
          await refetch()
          await loadOrgs()
          setCreateOpen(false)
        }}
      />
    </>
  )
}
