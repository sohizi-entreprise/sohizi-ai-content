import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"
import { AssetSkeleton, TextSkeleton } from "@sohizi/ui/content-skeletons"
import { TextEditorView } from "../content/text-editor-view"
import { getFileContentQueryOptions } from "../../query-mutations"
import { useEditorStore } from "../../stores/editor-store"
import AssetViewer from "../content/asset-viewer"
import { SkillEditorView } from "../content/skill-editor-view"
import { StoryboardEditorView } from "../content/storyboard-editor-view"
import type { EditorTab } from "../../types"
import { FileSystemVideoEditor } from "@/features/video-editor"
import { MediaGenerator } from "@/features/media-generator"

interface ContentRouterProps {
  tab: EditorTab
}

export function ContentRouter({ tab }: ContentRouterProps) {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/editor",
  })

  const isMediaGenerator = tab.name === "media-generator"

  if (tab.name === "video-editor" || tab.type === "video-editor") {
    return (
      <FileSystemVideoEditor
        projectId={projectId}
        fileNodeId={tab.id}
        fileName={tab.name}
        filePath={tab.path}
        key={tab.id}
      />
    )
  }

  if (isMediaGenerator) {
    return <MediaGenerator />
  }

  return <ServerRenderedContent tab={tab} projectId={projectId} />
}

function ServerRenderedContent({
  tab,
  projectId,
}: ContentRouterProps & { projectId: string }) {
  const baseQueryOptions = getFileContentQueryOptions(projectId, tab.id)
  const { data, isLoading } = useQuery(baseQueryOptions)
  const initLastSavedAt = useEditorStore((s) => s.initLastSavedAt)

  useEffect(() => {
    if (!data) return

    if (
      (data.type === "markdown" || data.type === "storyboard") &&
      data.updatedAt
    ) {
      initLastSavedAt(tab.id, data.updatedAt)
      return
    }

    if (data.type === "skill" && data.updatedAt) {
      initLastSavedAt(tab.id, data.updatedAt)
    }
  }, [data, initLastSavedAt, tab.id])

  if (isLoading) {
    if (
      tab.type === "document" ||
      tab.type === "skill" ||
      tab.type === "storyboard"
    ) {
      return (
        <div className="h-full w-full overflow-hidden">
          <div className="mx-auto min-w-2xl max-w-3xl px-6 pb-8 pt-12 space-y-4">
            <TextSkeleton className="animate-pulse" />
            <TextSkeleton className="animate-pulse" />
            <TextSkeleton className="animate-pulse" />
            <TextSkeleton className="animate-pulse" />
            <TextSkeleton className="animate-pulse" />
          </div>
        </div>
      )
    }

    return <AssetSkeleton />
  }

  if (data === undefined) {
    return <div>Error: File content not found</div>
  }

  switch (data.type) {
    case "markdown":
      return (
        <TextEditorView
          tab={tab}
          initialContent={data.content}
          initialRevision={data.revision}
          key={tab.id}
        />
      )
    case "storyboard":
      return (
        <StoryboardEditorView
          tab={tab}
          initialContent={data.content}
          key={tab.id}
        />
      )
    case "skill":
      return (
        <SkillEditorView
          key={tab.id}
          tab={tab}
          initialContent={data.content}
          status={data.status}
          visibility={data.visibility}
        />
      )
    case "audio":
    case "video":
    case "image":
    case "document":
      return <AssetViewer {...data} />
    default:
      return null
  }
}
