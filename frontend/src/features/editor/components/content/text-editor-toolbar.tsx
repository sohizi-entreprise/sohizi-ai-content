import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  List,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import React from 'react'
import { useEditorState } from '@tiptap/react'
import { useEditorStore } from '../../stores/editor-store'
import type { Editor } from '@tiptap/core'
import type { ImageLayoutType } from '../../extensions/image-layout'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function TextEditorToolbar({
  editor,
  tabId,
}: {
  editor: Editor
  tabId: string
}) {
  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      canUndo: currentEditor.can().undo(),
      canRedo: currentEditor.can().redo(),
      isHeading1: currentEditor.isActive('heading', { level: 1 }),
      isHeading2: currentEditor.isActive('heading', { level: 2 }),
      isHeading3: currentEditor.isActive('heading', { level: 3 }),
      isBold: currentEditor.isActive('bold'),
      isItalic: currentEditor.isActive('italic'),
      isUnderline: currentEditor.isActive('underline'),
      isStrike: currentEditor.isActive('strike'),
      isBulletList: currentEditor.isActive('bulletList'),
      isAlignLeft: currentEditor.isActive({ textAlign: 'left' }),
      isAlignCenter: currentEditor.isActive({ textAlign: 'center' }),
      isAlignRight: currentEditor.isActive({ textAlign: 'right' }),
    }),
  })

  const savingStatus = useEditorStore((s) => s.savingStatus[tabId])

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
      separator: true,
    },
  ]

  const imageLayouts: Array<{ label: string; layout: ImageLayoutType }> = [
    { label: '1 image', layout: 'single' },
    { label: '2 images - horizontal', layout: 'double-horizontal' },
    { label: 'Image left + content', layout: 'image-left-content' },
    { label: 'Image right + content', layout: 'image-right-content' },
  ]

  return (
    <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border px-3">
      {options.map((option) => (
        <React.Fragment key={option.label}>
          <ToolbarButton
            onClick={option.onClick}
            disabled={option.disabled}
            isActive={option.isActive}
            title={option.label}
          >
            {option.icon}
          </ToolbarButton>
          {option.separator && (
            <Separator orientation="vertical" className="mx-1.5 h-5" />
          )}
        </React.Fragment>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            title="Insert image layout"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <ImageIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Image layout</DropdownMenuLabel>
          {imageLayouts.map((item) => (
            <DropdownMenuItem
              key={item.layout}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertImageLayout({ layout: item.layout })
                  .run()
              }
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto text-xs text-muted-foreground">
        <SavingStatus status={savingStatus} />
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

function SavingStatus({ status }: { status: 'saving' | 'saved' | 'error' }) {
  switch (status) {
    case 'saving':
      return <span className="text-xs text-muted-foreground">Saving...</span>
    case 'saved':
      return <span className="text-xs text-muted-foreground">Saved</span>
    case 'error':
      return <span className="text-xs text-muted-foreground">Error</span>
    default:
      return null
  }
}
