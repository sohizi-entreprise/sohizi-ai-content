import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useSession, authClient, organization } from '@/lib/auth-client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
  errorComponent: ({error}) => <div>Error loading dashboard: {error.message}</div>,
})

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
}

function RouteComponent() {
  const { data: session, isPending } = useSession()
  const [ready, setReady] = useState(false)
  const [showOrgModal, setShowOrgModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (isPending) return

    if (!session) {
      navigate({ to: '/sign-in' })
      return
    }

    authClient.organization.list().then(({ data }) => {
      if (!data || data.length === 0) {
        setShowOrgModal(true)
      }
      setReady(true)
    })
  }, [session, isPending, navigate])

  if (isPending || !ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className='h-full'>
        <OrgSetupModal
          open={showOrgModal}
          onCreated={() => setShowOrgModal(false)}
        />
        <Outlet />
    </div>
  )
}

function OrgSetupModal({
  open,
  onCreated,
}: {
  open: boolean
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const slug = toSlug(name)
    const { error: orgError } = await organization.create({ name, slug })

    if (orgError) {
      setError(orgError.message || 'Failed to create organization')
      setLoading(false)
      return
    }

    setLoading(false)
    onCreated()
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
              <p className="text-xs text-muted-foreground">
                Slug: {toSlug(name)}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !name.trim()}
          >
            {loading && <Spinner />}
            {loading ? 'Creating...' : 'Continue'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
