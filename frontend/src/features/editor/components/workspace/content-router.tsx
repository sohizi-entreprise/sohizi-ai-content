import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { TextEditorView } from '../content/text-editor-view'
import { getFileContentQueryOptions } from '../../query-mutations'
import type { EditorTab } from '../../types'
import { VideoEditor } from '@/features/video-editor'
import { MediaGenerator } from '@/features/media-generator'
import AssetViewer from '../content/asset-viewer'
import { SkillEditorView } from '../content/skill-editor-view'

interface ContentRouterProps {
  tab: EditorTab
}

export function ContentRouter({ tab }: ContentRouterProps) {
  const { projectId } = useParams({
    from: '/dashboard/projects/$projectId/editor',
  })

  const isMediaGenerator = tab.name === 'media-generator'

  if (tab.name === 'video-editor' || tab.format === 'video-editor') {
    return <VideoEditor projectId={projectId} fileNodeId={tab.id} key={tab.id} />
  }

  if (isMediaGenerator) {
    return <MediaGenerator />
  }

  return <ServerRenderedContent tab={tab} projectId={projectId} />
}

function ServerRenderedContent({ tab, projectId }: ContentRouterProps & { projectId: string }) {
  const baseQueryOptions = getFileContentQueryOptions(projectId, tab.id)
  const { data, isLoading } = useQuery(baseQueryOptions)

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (data === undefined){
    return <div>Error: File content not found</div>
  }

  switch (data.type) {
    case 'markdown':
      return <TextEditorView
        tab={tab}
        initialContent={data.content as string}
        initialRevision={data.revision ?? 1}
        key={tab.id}
      />
    case 'skill':
      return <SkillEditorView
        tab={tab}
        description={data.data.description}
        instruction={data.data.instructions}
      />
    case 'audio':
    case 'video':
    case 'image':
    case 'document':
      return <AssetViewer {...data} />
    default:
      return null
  }

}
