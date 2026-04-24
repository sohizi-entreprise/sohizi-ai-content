import type { EditorTab } from '../../types'
import { getContentType } from '../../types'
import { TextEditorView } from '../content/text-editor-view'
import { VideoStoryboard } from '../content/video-storyboard'

interface ContentRouterProps {
  tab: EditorTab
}

export function ContentRouter({ tab }: ContentRouterProps) {
  const contentType = getContentType(tab.extension)

  if (contentType === 'video') {
    return <VideoStoryboard tab={tab} />
  }

  return <TextEditorView tab={tab} />
}
