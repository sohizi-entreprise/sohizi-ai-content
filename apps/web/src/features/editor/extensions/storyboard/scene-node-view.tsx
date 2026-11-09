import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronDown,
  GripVertical,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { insertSceneAfter } from "./use-storyboard-dnd"
import { useStoryboardContext } from "./storyboard-context"
import type { ReactNodeViewProps } from "@tiptap/react"
import { cn } from "@/lib/utils"

export function SceneNodeView({
  node,
  editor,
  deleteNode,
}: ReactNodeViewProps) {
  const sceneId: string = node.attrs.sceneId
  const { attachScene, openNewShotSheet } = useStoryboardContext()
  const [collapsed, setCollapsed] = useState(false)

  // Positional scene number, derived from the scene's index in the document.
  // The doc is a flat list of scenes, and any reorder replaces the whole doc
  // (see moveScene), so this stays in sync on structural changes.
  let sceneNumber = 0
  {
    let seen = 0
    editor.state.doc.forEach((child) => {
      if (child.type.name === "storyboardScene") {
        seen += 1
        if (child.attrs.sceneId === sceneId) sceneNumber = seen
      }
    })
  }
  const sceneLabel = `Scene ${String(sceneNumber).padStart(2, "0")}`

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sceneId, data: { type: "scene", sceneId } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <NodeViewWrapper
      ref={setNodeRef}
      style={style}
      data-scene-id={sceneId}
      className={cn(
        "storyboard-scene-wrapper group/scene",
        collapsed && "is-collapsed",
        isDragging && "storyboard-scene-dragging",
      )}
    >
      <div className="storyboard-scene">
        <div className="storyboard-scene-rail" contentEditable={false}>
          <button
            type="button"
            className="storyboard-rail-btn"
            title={
              collapsed ? "Expand scene details" : "Collapse scene details"
            }
            aria-label={
              collapsed ? "Expand scene details" : "Collapse scene details"
            }
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((prev) => !prev)}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-150",
                collapsed && "-rotate-90",
              )}
            />
          </button>
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="storyboard-rail-btn cursor-grab active:cursor-grabbing"
            title="Drag to reorder scene"
            aria-label="Drag to reorder scene"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <button
            type="button"
            className="storyboard-rail-btn"
            title="Append shot"
            aria-label="Append shot"
            onClick={() => openNewShotSheet(sceneId)}
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            className="storyboard-rail-btn"
            title="Attach scene to chat"
            aria-label="Attach scene to chat"
            onClick={() => attachScene(sceneNumber)}
          >
            <Paperclip className="size-4" />
          </button>
          <button
            type="button"
            className="storyboard-rail-btn storyboard-rail-btn-danger"
            title="Delete scene"
            aria-label="Delete scene"
            onClick={deleteNode}
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {/*
          Atomic, non-editable scene number that sits on its own line above the
          title, so long titles never collide with the action rail.
        */}
        <div className="storyboard-scene-eyebrow" contentEditable={false}>
          {sceneLabel}
        </div>

        {/*
          NodeViewContent holds the scene's child nodes in order:
          sceneTitle, sceneAction, environment, lighting, then the shotGrid.
        */}
        <NodeViewContent className="storyboard-scene-body" as="div" />
      </div>

      <div className="storyboard-scene-between" contentEditable={false}>
        <span className="storyboard-scene-between-line" aria-hidden="true" />
        <button
          type="button"
          className="storyboard-scene-add-below"
          title="Add scene below"
          aria-label="Add scene below"
          onClick={() => insertSceneAfter(editor, sceneId)}
        >
          <Plus className="size-3.5" />
        </button>
        <span className="storyboard-scene-between-line" aria-hidden="true" />
      </div>
    </NodeViewWrapper>
  )
}
