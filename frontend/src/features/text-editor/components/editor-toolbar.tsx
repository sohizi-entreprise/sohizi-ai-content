import type { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconHighlight,
  IconArrowBackUp,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

type EditorToolbarProps = {
  editor: Editor
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const ToolbarButton = ({
    onClick,
    isActive = false,
    disabled = false,
    children,
    title,
  }: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    children: React.ReactNode
    title?: string
  }) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent!',
        isActive && 'bg-white/10 text-foreground'
      )}
    >
      {children}
    </Button>
  )

  return (
    <div className="border-b border-white/10 bg-background sticky top-10 z-10">
      <div className="container max-w-paper flex items-center gap-1 mx-auto">
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (⌘Z)"
        >
          <IconArrowBackUp className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (⌘⇧Z)"
        >
          <IconArrowBackUp className="size-4 -scale-x-100" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (⌘B)"
        >
          <IconBold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (⌘I)"
        >
          <IconItalic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <IconStrikethrough className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive('highlight')}
          title="Highlight"
        >
          <IconHighlight className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Alignment - These work with our custom nodes */}
        <ToolbarButton
          onClick={() => {
            // For screenplay, alignment is typically handled by block type
            // This is a placeholder for custom alignment logic
          }}
          title="Align Left"
        >
          <IconAlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            // Center alignment
          }}
          title="Align Center"
        >
          <IconAlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            // Right alignment
          }}
          title="Align Right"
        >
          <IconAlignRight className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Block type indicator */}
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">
            {getActiveBlockType(editor)}
          </span>
        </div>
      </div>
    </div>
  )
}

function getActiveBlockType(editor: Editor): string {
  if (editor.isActive('slugline')) return 'Slugline'
  if (editor.isActive('action')) return 'Action'
  if (editor.isActive('character')) return 'Character'
  if (editor.isActive('dialogue')) return 'Dialogue'
  if (editor.isActive('parenthetical')) return 'Parenthetical'
  if (editor.isActive('transition')) return 'Transition'
  if (editor.isActive('shot')) return 'Shot'
  if (editor.isActive('note')) return 'Note'
  if (editor.isActive('pageBreak')) return 'Page Break'
  return 'Paragraph'
}
