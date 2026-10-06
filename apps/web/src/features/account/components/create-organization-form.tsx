import { captureAnalyticsEvent } from "@sohizi/analytics/browser"
import { useState } from "react"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import { Spinner } from "@sohizi/ui/spinner"
import { toSlug } from "../lib"
import { organization } from "@/lib/auth-client"

export function CreateOrganizationForm({
  onCreated,
  submitLabel = "Continue",
}: {
  onCreated: () => void | Promise<void>
  submitLabel?: string
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

    captureAnalyticsEvent("organization_created", {})
    await organization.setActive({ organizationId: orgData.id })
    await onCreated()
    setName("")
    setLoading(false)
  }

  return (
    <form onSubmit={handleCreateOrg} className="space-y-4">
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
          <p className="text-xs text-muted-foreground">Slug: {toSlug(name)}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        className="w-full"
        disabled={loading || !name.trim()}
      >
        {loading && <Spinner />}
        {loading ? "Creating..." : submitLabel}
      </Button>
    </form>
  )
}
