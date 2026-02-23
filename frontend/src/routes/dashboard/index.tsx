import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/')({
    beforeLoad: () => {
        throw redirect({ to: '/dashboard/main/projects' })
      },
      component: () => null,
})
