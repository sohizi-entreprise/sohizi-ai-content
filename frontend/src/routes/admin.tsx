import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

type AdminPath =
  | '/admin/models'
  | '/admin/options'
  | '/admin/commands'
  | '/admin/skills'
  | '/admin/content-categories'

function AdminLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (isPending) return
    if (!session) {
      navigate({ to: '/sign-in' })
      return
    }
    if (session.user.type !== 'admin') {
      navigate({ to: '/dashboard/main/projects' })
    }
  }, [session, isPending, navigate])

  if (isPending || !session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (session.user.type !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link to="/admin/models" className="text-lg font-semibold tracking-tight">
              Admin
            </Link>
            <nav className="flex flex-wrap items-center gap-1">
              <AdminNavLink to="/admin/models">Models</AdminNavLink>
              <AdminNavLink to="/admin/options">Options</AdminNavLink>
              <AdminNavLink to="/admin/commands">Commands</AdminNavLink>
              <AdminNavLink to="/admin/skills">Skills</AdminNavLink>
              <AdminNavLink to="/admin/content-categories">Categories</AdminNavLink>
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
          'rounded-md px-3 py-1.5 text-sm transition bg-muted text-foreground',
        ),
      }}
    >
      {children}
    </Link>
  )
}
