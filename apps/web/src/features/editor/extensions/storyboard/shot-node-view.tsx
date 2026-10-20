import { NodeViewWrapper } from "@tiptap/react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useDrop } from "react-dnd"
import { useQueryClient } from "@tanstack/react-query"
import {
  GripVertical,
  ImageIcon,
  Paperclip,
  Pencil,
  Trash2,
} from "lucide-react"
import { getShotPosition } from "./storyboard-sequence"
import { useStoryboardContext } from "./storyboard-context"
import { fetchImageAssetUrl, findDraggedImageNode } from "./shot-image-drop"
import { updateShot } from "./use-storyboard-dnd"
import type { ReactNodeViewProps } from "@tiptap/react"
import {
  ARBORIST_NODE_DRAG_TYPE,
  type ArboristNodeDragItem,
} from "../../utils/arborist-dnd"
import { useFileTreeStore } from "../../stores/file-tree-store"
import { cn } from "@/lib/utils"
import { thumbnailImageUrl } from "@/utils/transform-url"

export function ShotNodeView({ node, editor, deleteNode }: ReactNodeViewProps) {
  const shotId: string = node.attrs.shotId
  const image: string = node.attrs.image ?? ""
  const action: string = node.attrs.action ?? ""
  const { openShotSheet, attachShot } = useStoryboardContext()
  const position = getShotPosition(editor, shotId)
  const queryClient = useQueryClient()

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shotId, data: { type: "shot", shotId } })

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: ARBORIST_NODE_DRAG_TYPE,
      canDrop: (item: ArboristNodeDragItem) =>
        findDraggedImageNode(queryClient, item) != null,
      drop: (item: ArboristNodeDragItem) => {
        const dragged = findDraggedImageNode(queryClient, item)
        const projectId = useFileTreeStore.getState().projectId
        if (!dragged || !projectId) return
        void fetchImageAssetUrl(projectId, dragged.id)
          .then((url) => {
            if (url) updateShot(editor, shotId, { image: url })
          })
          .catch((error) => {
            console.error("Failed to apply image to shot:", error)
          })
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [queryClient, editor, shotId],
  )

  const setShotRef = (element: HTMLElement | null) => {
    setNodeRef(element)
    drop(element)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <NodeViewWrapper
      ref={setShotRef}
      style={style}
      data-shot-id={shotId}
      contentEditable={false}
      className={cn(
        "storyboard-shot group/shot",
        isDragging && "storyboard-shot-dragging",
        isOver && canDrop && "storyboard-shot-drop-over",
      )}
      onClick={() => openShotSheet(shotId)}
    >
      <div
        className="storyboard-shot-toolbar"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="storyboard-shot-btn cursor-grab active:cursor-grabbing"
          title="Drag shot"
          aria-label="Drag shot"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          className="storyboard-shot-btn"
          title="Attach shot to chat"
          aria-label="Attach shot to chat"
          disabled={!position}
          onClick={() => {
            if (position) attachShot(position.sceneNumber, position.shotNumber)
          }}
        >
          <Paperclip className="size-3.5" />
        </button>
        <button
          type="button"
          className="storyboard-shot-btn"
          title="Edit shot"
          aria-label="Edit shot"
          onClick={() => openShotSheet(shotId)}
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          className="storyboard-shot-btn storyboard-shot-btn-danger"
          title="Delete shot"
          aria-label="Delete shot"
          onClick={deleteNode}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="storyboard-shot-image">
        {image ? (
          <img src={thumbnailImageUrl(image)} alt={action || "Shot"} />
        ) : (
          <div className="storyboard-shot-image-empty">
            <ImageIcon className="size-7" />
          </div>
        )}
      </div>

      <div className="storyboard-shot-body">
        <p className="storyboard-shot-desc">
          {action || "No description yet."}
        </p>
      </div>
    </NodeViewWrapper>
  )
}
