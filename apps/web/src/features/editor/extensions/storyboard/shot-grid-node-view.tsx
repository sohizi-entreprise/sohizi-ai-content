import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import { useDroppable } from "@dnd-kit/core"
import { Plus } from "lucide-react"
import { useStoryboardContext } from "./storyboard-context"
import type { ReactNodeViewProps } from "@tiptap/react"
import { cn } from "@/lib/utils"

export function ShotGridNodeView({ editor, getPos }: ReactNodeViewProps) {
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

  const { setNodeRef, isOver } = useDroppable({
    id: sceneId ? `grid:${sceneId}` : `grid:unknown`,
    data: { type: "grid", sceneId },
  })

  const handleAddShot = () => {
    if (!sceneId) return
    openNewShotSheet(sceneId)
  }

  return (
    <NodeViewWrapper
      className={cn(
        "storyboard-shot-grid",
        isOver && "storyboard-shot-grid-over",
      )}
    >
      <div ref={setNodeRef} className="storyboard-shot-grid-inner">
        <NodeViewContent className="storyboard-shot-grid-content" as="div" />
        <button
          type="button"
          className="storyboard-shot-placeholder"
          contentEditable={false}
          title="Append shot"
          aria-label="Append shot"
          onClick={handleAddShot}
        >
          <span className="storyboard-shot-placeholder-icon">
            <Plus className="size-5" />
          </span>
          <span className="storyboard-shot-placeholder-title">Append Shot</span>
          <span className="storyboard-shot-placeholder-hint">
            Click or drag image file
          </span>
        </button>
      </div>
    </NodeViewWrapper>
  )
}
