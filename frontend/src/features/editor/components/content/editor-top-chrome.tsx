import { Redo2, Undo2 } from 'lucide-react'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEditorStore } from '../../stores/editor-store'

const SAVE_STATUS_LABEL: Record<'saving' | 'saved' | 'error', string> = {
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Error saving',
}

export function EditorTopChrome({
  editor,
  tabId,
}: {
  editor: Editor
  tabId: string
}) {
  const savingStatus = useEditorStore((s) => s.savingStatus[tabId])

  const { canUndo, canRedo } = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      canUndo: currentEditor.can().undo(),
      canRedo: currentEditor.can().redo(),
    }),
  })

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between px-3 backdrop-blur-sm">
      <div className="pointer-events-auto flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Undo"
          disabled={!canUndo}
          onMouseDown={(event) => {
            event.preventDefault()
            editor.chain().focus().undo().run()
          }}
          className="size-7 text-foreground hover:text-foreground"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Redo"
          disabled={!canRedo}
          onMouseDown={(event) => {
            event.preventDefault()
            editor.chain().focus().redo().run()
          }}
          className="size-7 text-foreground hover:text-foreground"
        >
          <Redo2 className="size-4" />
        </Button>
      </div>

      <div
        className={cn(
          'pointer-events-none text-xs text-muted-foreground transition-opacity',
          savingStatus ? 'opacity-100' : 'opacity-0',
          savingStatus === 'error' && 'text-destructive',
        )}
      >
        {savingStatus ? SAVE_STATUS_LABEL[savingStatus] : 'Saved'}
      </div>
    </div>
  )
}
