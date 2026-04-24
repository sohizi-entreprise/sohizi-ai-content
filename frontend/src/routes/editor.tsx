import { createFileRoute } from '@tanstack/react-router'
import { VideoProductionEditor } from '@/features/editor'

export const Route = createFileRoute('/editor')({
  component: RouteComponent,
})

function RouteComponent() {
  return <VideoProductionEditor />
}
