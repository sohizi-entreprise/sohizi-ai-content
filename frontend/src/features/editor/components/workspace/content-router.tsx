import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { getContentType } from '../../types'
import { TextEditorView } from '../content/text-editor-view'
import { VideoStoryboard } from '../content/video-storyboard'
import { getFileContentQueryOptions } from '../../query-mutations'
import type { EditorTab } from '../../types'

interface ContentRouterProps {
  tab: EditorTab
}

export function ContentRouter({ tab }: ContentRouterProps) {
  const contentType = getContentType(tab.extension)
  const { projectId } = useParams({
    from: '/dashboard/projects/$projectId/editor',
  })

  const { data, isLoading } = useQuery(
    getFileContentQueryOptions(projectId, tab.id),
  )

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (contentType === 'video') {
    return <VideoStoryboard tab={tab} />
  }

  return (
    <TextEditorView
      tab={tab}
      initialContent={data?.content as string}
      initialRevision={data?.revision ?? 1}
      key={tab.id}
    />
  )
}
