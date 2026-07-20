import { useEffect } from 'react'
import type { ConnectDragPreview } from 'react-dnd'
import { getEmptyImage } from 'react-dnd-html5-backend'

/** Hide the native HTML5 drag ghost; custom overlays (e.g. timeline) stay. */
export function useEmptyDragPreview(preview: ConnectDragPreview) {
  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true })
  }, [preview])
}
