import SceneOverview from '@/features/script/components/scene-overview'
import { createFileRoute, } from '@tanstack/react-router'


export const Route = createFileRoute('/dashboard/projects/$projectId/script')({
  loader: () => {
    
  },
  component: ScriptPage,
  notFoundComponent: () => <div>Project not found</div>,
  errorComponent: ({error}) => <div className='text-red-500'>Error script project: {error.message}</div>,
})

function ScriptPage() {
  
  // Collect all dialogue and narration from shots

  return (
    <SceneOverview />
  )
}

