import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Film } from "lucide-react"
import { useRef, useState, type PointerEvent } from "react"
import type { SceneSummary } from "../../extensions/storyboard"
import { cn } from "@/lib/utils"

interface StoryboardScenePanelProps {
  scenes: Array<SceneSummary>
  onSelect: (sceneId: string) => void
}

type PanelPin =
  { edge: "top"; shift: number } | { edge: "bottom"; bottom: number }

export function StoryboardScenePanel({
  scenes,
  onSelect,
}: StoryboardScenePanelProps) {
  const hitRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState<PanelPin | null>(null)

  const handlePointerEnter = (event: PointerEvent<HTMLElement>) => {
    const el = hitRef.current
    if (el && pin === null) {
      const rect = el.getBoundingClientRect()
      const enteredFromBottom = event.clientY >= rect.top + rect.height / 2
      const parent = el.offsetParent
      if (enteredFromBottom && parent instanceof HTMLElement) {
        // Keep the bottom edge where the pointer crossed it and grow upward.
        // Growing downward slides that edge back across the pointer.
        const bottom = Math.floor(
          parent.getBoundingClientRect().bottom - rect.bottom,
        )
        setPin({ edge: "bottom", bottom })
      } else if (el.offsetHeight > 0) {
        setPin({ edge: "top", shift: el.offsetHeight / 2 })
      }
    }
    setOpen(true)
  }

  const handlePointerLeave = (event: PointerEvent<HTMLElement>) => {
    const el = hitRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const stillInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      if (stillInside) return
    }
    setPin(null)
    setOpen(false)
  }

  return (
    <aside
      ref={hitRef}
      className={cn("storyboard-panel-hit", open && "is-open")}
      style={
        pin?.edge === "top"
          ? { transform: `translateY(-${pin.shift}px)` }
          : pin?.edge === "bottom"
            ? { top: "auto", bottom: pin.bottom, transform: "none" }
            : undefined
      }
      aria-label="Scene navigator"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div className="storyboard-panel">
        <div className="storyboard-panel-title">Scenes</div>
        <SortableContext
          items={scenes.map((scene) => `preview:${scene.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="storyboard-panel-list scrollbar-hide">
            {scenes.map((scene, index) => (
              <ScenePreview
                key={scene.id}
                scene={scene}
                index={index}
                onSelect={onSelect}
              />
            ))}
          </div>
        </SortableContext>
        {scenes.length === 0 ? (
          <p className="storyboard-panel-empty">No scenes yet.</p>
        ) : null}
      </div>
    </aside>
  )
}

function ScenePreview({
  scene,
  index,
  onSelect,
}: {
  scene: SceneSummary
  index: number
  onSelect: (sceneId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `preview:${scene.id}`,
    data: { type: "scene-preview", sceneId: scene.id },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className={cn(
        "storyboard-panel-item",
        isDragging && "storyboard-panel-item-dragging",
      )}
      title={scene.title || `Scene ${index + 1}`}
      onClick={() => onSelect(scene.id)}
      {...attributes}
      {...listeners}
    >
      <span className="storyboard-panel-thumb">
        {scene.firstImage ? (
          <img
            src={scene.firstImage}
            alt={scene.title || `Scene ${index + 1}`}
          />
        ) : (
          <Film className="size-3.5 opacity-60" />
        )}
      </span>
      <span className="storyboard-panel-meta">
        <span className="storyboard-panel-index">Scene {index + 1}</span>
        <span className="storyboard-panel-name">
          {scene.title || "Untitled"}
        </span>
      </span>
    </button>
  )
}
