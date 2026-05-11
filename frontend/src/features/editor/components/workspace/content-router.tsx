import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { getContentType } from '../../types'
import { TextEditorView } from '../content/text-editor-view'
import { getFileContentQueryOptions } from '../../query-mutations'
import type { EditorTab } from '../../types'
import { VideoEditor } from '@/features/video-editor'
import { MediaGenerator } from '@/features/media-generator'

interface ContentRouterProps {
  tab: EditorTab
}

export function ContentRouter({ tab }: ContentRouterProps) {
  const contentType = getContentType(tab.extension)
  const { projectId } = useParams({
    from: '/dashboard/projects/$projectId/editor',
  })

  const isVideo = contentType === 'video'
  const isMediaGenerator = tab.name === 'media-generator'

  const baseQueryOptions = getFileContentQueryOptions(projectId, tab.id)
  const { data, isLoading } = useQuery({
    ...baseQueryOptions,
    enabled:
      !isVideo && !isMediaGenerator && (baseQueryOptions.enabled ?? true),
  })

  // Temporary

  if (tab.name === 'video-editor') {
    return <VideoEditor />
  }

  if (isMediaGenerator) {
    return <MediaGenerator />
  }

  if (isVideo) {
    return <VideoEditor />
  }

  if (isLoading) {
    return <div>Loading...</div>
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
