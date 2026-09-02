import { useMemo } from "react"
import { useVideoEditorStore } from "../store/editor-store"
import type { Clip } from "../store/types"

/** The clip currently being edited, or null when zero or many are selected. */
export function useSelectedClip(): Clip | null {
  const tracks = useVideoEditorStore((s) => s.tracks)
  const clipIds = useVideoEditorStore((s) => s.selection.clipIds)

  return useMemo(() => {
    if (clipIds.length !== 1) return null
    const id = clipIds[0]
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.id === id) return clip
      }
    }
    return null
  }, [tracks, clipIds])
}
