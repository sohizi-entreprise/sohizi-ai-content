import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  Undo2,
  Redo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { EditorTab } from '../../types'

const SAMPLE_CONTENT = `<h1>Episode 1 - Pilot</h1>
<h2>Opening Scene</h2>
<p>The camera pans across a dimly lit street. Rain glistens on the cobblestones as a lone figure walks toward the cafe entrance.</p>
<p>JAMES, late 20s, sits at a corner table nursing a coffee. His eyes scan the room with practiced nonchalance, but there's an edge to his posture that suggests he's waiting for something — or someone.</p>
<h2>Scene Notes</h2>
<ul>
<li>Establish mood: noir, tension, isolation</li>
<li>Warm interior vs cold exterior contrast</li>
<li>Background extras: 3-4 patrons, distant murmur</li>
</ul>
<p>The door swings open. A burst of cold air. ELENA enters, shaking rain from her umbrella. She spots James immediately but pretends not to.</p>
<blockquote><p>Director's note: Play up the tension in their eye contact. Neither wants to make the first move.</p></blockquote>`

interface TextEditorViewProps {
  tab: EditorTab
}

export function TextEditorView({ tab }: TextEditorViewProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Highlight,
    ],
    content: SAMPLE_CONTENT,
    editorProps: {
      attributes: {
        class:
          'prose prose-invert prose-sm max-w-none focus:outline-none',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border px-3">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo2 className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1.5 h-5" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1.5 h-5" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Underline"
        >
          <Underline className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1.5 h-5" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="size-4" />
        </ToolbarButton>

        <div className="ml-auto text-xs text-muted-foreground">
          {tab.name}
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <EditorContent editor={editor} className="[&_.tiptap]:outline-none [&_.tiptap]:min-h-[400px]" />
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  children: React.ReactNode
  title?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'size-7 text-muted-foreground hover:text-foreground',
        isActive && 'bg-accent/50 text-foreground',
      )}
    >
      {children}
    </Button>
  )
}
