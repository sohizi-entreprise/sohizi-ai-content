import { createFileRoute } from '@tanstack/react-router'
import { ParameterDetailPage } from '@/features/admin/components/parameter-detail-page'

export const Route = createFileRoute('/admin/parameters/$parameterId')({
  component: ParameterDetailRoute,
})

function ParameterDetailRoute() {
  const { parameterId } = Route.useParams()
  return <ParameterDetailPage parameterId={parameterId} />
}
