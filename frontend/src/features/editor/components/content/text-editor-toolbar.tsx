import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Heading1,
    Heading2,
    Heading3,
    List,
    Undo2,
    Redo2,
    AlignLeft,
    AlignCenter,
    AlignRight,
  } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import React from 'react'
import { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'

export default function TextEditorToolbar({editor, tabName}: {editor: Editor, tabName: string}) {

    const editorState = useEditorState({
        editor,
        selector: ({ editor }) => ({
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
            isHeading1: editor.isActive('heading', { level: 1 }),
            isHeading2: editor.isActive('heading', { level: 2 }),
            isHeading3: editor.isActive('heading', { level: 3 }),
            isBold: editor.isActive('bold'),
            isItalic: editor.isActive('italic'),
            isUnderline: editor.isActive('underline'),
            isStrike: editor.isActive('strike'),
            isBulletList: editor.isActive('bulletList'),
            isAlignLeft: editor.isActive({ textAlign: 'left' }),
            isAlignCenter: editor.isActive({ textAlign: 'center' }),
            isAlignRight: editor.isActive({ textAlign: 'right' }),
        }),
    })

    const options = [
        {
            label: 'Undo',
            icon: <Undo2 className="size-4" />,
            onClick: () => editor.chain().focus().undo().run(),
            disabled: !editorState.canUndo,
        },
        {
            label: 'Redo',
            icon: <Redo2 className="size-4" />,
            onClick: () => editor.chain().focus().redo().run(),
            disabled: !editorState.canRedo,
            separator: true,
        },
        {
            label: 'Heading 1',
            icon: <Heading1 className="size-4" />,
            onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            isActive: editorState.isHeading1,
        },
        {
            label: 'Heading 2',
            icon: <Heading2 className="size-4" />,
            onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            isActive: editorState.isHeading2,
        },
        {
            label: 'Heading 3',
            icon: <Heading3 className="size-4" />,
            onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            isActive: editorState.isHeading3,
            separator: true,
        },
        {
            label: 'Bold',
            icon: <Bold className="size-4" />,
            onClick: () => editor.chain().focus().toggleBold().run(),
            isActive: editorState.isBold,
        },
        {
            label: 'Italic',
            icon: <Italic className="size-4" />,
            onClick: () => editor.chain().focus().toggleItalic().run(),
            isActive: editorState.isItalic,
        },
        {
            label: 'Underline',
            icon: <Underline className="size-4" />,
            onClick: () => editor.chain().focus().toggleUnderline().run(),
            isActive: editorState.isUnderline,
        },
        {
            label: 'Strike',
            icon: <Strikethrough className="size-4" />,
            onClick: () => editor.chain().focus().toggleStrike().run(),
            isActive: editorState.isStrike,
            separator: true,
        },
        {
            label: 'Align Left',
            icon: <AlignLeft className="size-4" />,
            onClick: () => editor.chain().focus().setTextAlign('left').run(),
            isActive: editorState.isAlignLeft,
        },
        {
            label: 'Align Center',
            icon: <AlignCenter className="size-4" />,
            onClick: () => editor.chain().focus().setTextAlign('center').run(),
            isActive: editorState.isAlignCenter,
        },
        {
            label: 'Align Right',
            icon: <AlignRight className="size-4" />,
            onClick: () => editor.chain().focus().setTextAlign('right').run(),
            isActive: editorState.isAlignRight,
            separator: true,
        },
        {
            label: 'Bullet List',
            icon: <List className="size-4" />,
            onClick: () => editor.chain().focus().toggleBulletList().run(),
            isActive: editorState.isBulletList,
        },
    ]


  return (
    <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border px-3">
        {
            options.map((option)=>(
                <React.Fragment key={option.label}>
                <ToolbarButton
                    onClick={option.onClick}
                    disabled={option.disabled}
                    isActive={option.isActive}
                    title={option.label}
                >
                    {option.icon}
                </ToolbarButton>
                {option.separator && <Separator orientation="vertical" className="mx-1.5 h-5" />}
                </React.Fragment>
            ))
        }
        <div className="ml-auto text-xs text-muted-foreground">
          {tabName} --saving
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
