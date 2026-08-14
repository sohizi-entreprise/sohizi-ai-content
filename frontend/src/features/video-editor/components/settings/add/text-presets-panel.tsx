import { useDrag } from 'react-dnd'
import { cn } from '@/lib/utils'
import { useEmptyDragPreview } from '../../../hooks/use-empty-drag-preview'
import {
  flushTimelineDropPreview,
  VIDEO_EDITOR_TEXT_PRESET_DRAG_TYPE,
  type TextPresetDragItem,
} from '../../../utils/library-dnd'
import { TEXT_PRESETS, type TextPreset } from './text-presets'

export function TextPresetsPanel() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TEXT_PRESETS.map((preset) => (
        <TextPresetCell key={preset.id} preset={preset} />
      ))}
    </div>
  )
}

function TextPresetCell({ preset }: { preset: TextPreset }) {
  const [{ isDragging }, drag, preview] = useDrag<
    TextPresetDragItem,
    void,
    { isDragging: boolean }
  >(
    () => ({
      type: VIDEO_EDITOR_TEXT_PRESET_DRAG_TYPE,
      item: {
        presetId: preset.id,
        label: preset.label,
        style: preset.style,
      },
      end: () => {
        flushTimelineDropPreview()
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [preset],
  )
  // Native preview is suppressed; LibraryDragLayer follows the cursor until
  // the pointer enters the timeline, then the timeline ghost takes over.
  useEmptyDragPreview(preview)

  return (
    <button
      ref={(node) => {
        drag(node)
      }}
      type="button"
      draggable={false}
      className={cn(
        'flex h-14 cursor-grab items-center justify-center rounded-xl bg-muted/55 px-1.5 text-center text-foreground ring-1 ring-border/40 active:cursor-grabbing',
        'hover:bg-muted hover:ring-border/70',
        isDragging && 'opacity-40',
      )}
      title={`Drag "${preset.label}" to timeline`}
    >
      <span
        className={cn(
          'line-clamp-2 max-w-full leading-tight',
          preset.previewClassName,
        )}
        style={preset.previewStyle}
      >
        {preset.label}
      </span>
    </button>
  )
}
