import { useEffect } from 'react'
import { useVideoEditorStore } from '../store/editor-store'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Keyboard shortcuts for the video editor (Delete selected clips, etc.). */
export function useVideoEditorHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selection, deleteClip } = useVideoEditorStore.getState()
        if (selection.clipIds.length === 0) return
        e.preventDefault()
        for (const id of [...selection.clipIds]) deleteClip(id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
