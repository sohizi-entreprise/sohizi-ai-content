import { useDragLayer } from 'react-dnd'
import { ARBORIST_NODE_DRAG_TYPE } from '@/features/editor/utils/arborist-dnd'
import {
  VIDEO_EDITOR_TEXT_PRESET_DRAG_TYPE,
  isPointerOverTimelineDropArea,
  type LibraryAssetDragItem,
  type TextPresetDragItem,
} from '../../../utils/library-dnd'
import { cn } from '@/lib/utils'

/**
 * Shows a floating preview while dragging from the Add library.
 * Hidden once the pointer enters the timeline so only the timeline ghost remains.
 */
export function LibraryDragLayer() {
  const { isDragging, itemType, item, clientOffset, overTimeline } =
    useDragLayer((monitor) => {
      const offset = monitor.getClientOffset()
      return {
        isDragging: monitor.isDragging(),
        itemType: monitor.getItemType(),
        item: monitor.getItem(),
        clientOffset: offset,
        overTimeline: isPointerOverTimelineDropArea(offset),
      }
    })

  if (!isDragging || !clientOffset || overTimeline) return null

  const label = getLibraryDragLabel(itemType, item)
  if (!label) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        className={cn(
          'absolute max-w-40 truncate rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md',
        )}
        style={{
          left: clientOffset.x + 12,
          top: clientOffset.y + 12,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function getLibraryDragLabel(
  itemType: string | symbol | null,
  item: unknown,
): string | null {
  if (itemType === VIDEO_EDITOR_TEXT_PRESET_DRAG_TYPE) {
    return (item as TextPresetDragItem).label
  }
  if (itemType === ARBORIST_NODE_DRAG_TYPE) {
    const asset = item as LibraryAssetDragItem
    if (asset?.fromLibrary) return asset.label
  }
  return null
}
