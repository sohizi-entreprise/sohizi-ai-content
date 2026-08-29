import { useEffect } from 'react'
import { getEmptyImage } from 'react-dnd-html5-backend'
import type { ConnectDragPreview } from 'react-dnd'

/** Hide the native HTML5 drag ghost; custom overlays (e.g. timeline) stay. */
export function useEmptyDragPreview(preview: ConnectDragPreview) {
  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true })
  }, [preview])
}
