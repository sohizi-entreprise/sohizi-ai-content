import { createFileRoute } from '@tanstack/react-router'
import { ModelDetailPage } from '@/features/admin/components/model-detail-page'

export const Route = createFileRoute('/admin/models/$modelId')({
  component: ModelDetailRoute,
})

function ModelDetailRoute() {
  const { modelId } = Route.useParams()
  return <ModelDetailPage modelId={modelId} />
}
