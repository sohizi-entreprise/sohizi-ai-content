import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import { useDroppable } from "@dnd-kit/core"
import { Plus } from "lucide-react"
import { useStoryboardContext } from "./storyboard-context"
import type { ReactNodeViewProps } from "@tiptap/react"
import { cn } from "@/lib/utils"

export function ShotGridNodeView({ node, editor, getPos }: ReactNodeViewProps) {
  const { openNewShotSheet } = useStoryboardContext()

  const resolveSceneId = (): string | null => {
    if (typeof getPos !== "function") return null
    const pos = getPos()
    if (pos == null) return null
    const $pos = editor.state.doc.resolve(pos)
    const parent = $pos.parent
    return parent.type.name === "storyboardScene"
      ? (parent.attrs.sceneId as string)
      : null
  }

  const sceneId = resolveSceneId()
  const isEmpty = node.childCount === 0

  const { setNodeRef, isOver } = useDroppable({
    id: sceneId ? `grid:${sceneId}` : `grid:unknown`,
    data: { type: "grid", sceneId },
  })

  return (
    <NodeViewWrapper
      className={cn(
        "storyboard-shot-grid",
        isOver && "storyboard-shot-grid-over",
      )}
    >
      <div ref={setNodeRef} className="storyboard-shot-grid-inner">
        <NodeViewContent className="storyboard-shot-grid-content" as="div" />
        {isEmpty ? (
          <button
            type="button"
            contentEditable={false}
            className="storyboard-shot-empty-card"
            title="Add shot"
            aria-label="Add shot"
            onClick={() => {
              if (sceneId) openNewShotSheet(sceneId)
            }}
          >
            <span className="storyboard-shot-empty-icon">
              <Plus className="size-5" />
            </span>
            <span className="storyboard-shot-empty-label">Add shot</span>
          </button>
        ) : null}
      </div>
    </NodeViewWrapper>
  )
}
