import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  LucideProps,
  Minus,
  Play,
  Plus,
  Strikethrough,
  Table2,
  TextAlignJustify,
  TextQuote,
  Underline,
} from 'lucide-react'
import React, { useState } from 'react'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { LinkInsertDialog } from './link-insert-dialog'
import { YoutubeEmbedDialog } from './youtube-embed-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ClassValue } from 'clsx'

type ToolbarOption = {
  label: string
  icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>
  onClick: () => void
  disabled?: boolean
  isActive?: boolean
  separator?: boolean
  children?: ToolbarOption[]
}

function preventToolbarFocusLoss(event: React.MouseEvent) {
  event.preventDefault()
}

function preventDropdownFocusChange(event: Event) {
  event.preventDefault()
}

function runToolbarCommand(editor: Editor, command: () => void) {
  return (event: Event) => {
    event.preventDefault()
    command()
    queueMicrotask(() => {
      if (!editor.isDestroyed) {
        editor.view.focus()
      }
    })
  }
}

/** Safe when an extension (e.g. TableKit) is not registered on this editor. */
function canRunCommand(editor: Editor, commandName: string): boolean {
  const command = (editor.can() as Record<string, unknown>)[commandName]
  return typeof command === 'function' ? Boolean((command as () => boolean)()) : false
}

function getToolbarDropdownContentProps(portalContainer?: HTMLElement | null) {
  return {
    align: 'start' as const,
    // Keep submenus inside the TipTap bubble element so blur doesn't hide the toolbar
    // (body-portaled menus position at 0,0 after the bubble unmounts).
    container: portalContainer ?? undefined,
    onOpenAutoFocus: preventDropdownFocusChange,
    onCloseAutoFocus: preventDropdownFocusChange,
    onMouseDown: preventToolbarFocusLoss,
  }
}

export default function TextEditorToolbar({
  editor,
  className,
  bare = false,
  portalContainer = null,
}: {
  editor: Editor
  className?: ClassValue
  /** When true, omit the outer glass shell (for embedding in the bubble menu). */
  bare?: boolean
  /** Portal target for nested dropdowns. Required when embedded in TipTap BubbleMenu. */
  portalContainer?: HTMLElement | null
}) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false)
  const dropdownContentProps = getToolbarDropdownContentProps(portalContainer)

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      isHeading1: currentEditor.isActive('heading', { level: 1 }),
      isHeading2: currentEditor.isActive('heading', { level: 2 }),
      isHeading3: currentEditor.isActive('heading', { level: 3 }),
      isBold: currentEditor.isActive('bold'),
      isItalic: currentEditor.isActive('italic'),
      isUnderline: currentEditor.isActive('underline'),
      isStrike: currentEditor.isActive('strike'),
      isBulletList: currentEditor.isActive('bulletList'),
      isOrderedList: currentEditor.isActive('orderedList'),
      isTaskList: currentEditor.isActive('taskList'),
      isBlockquote: currentEditor.isActive('blockquote'),
      isLink: currentEditor.isActive('link'),
      linkHref: (currentEditor.getAttributes('link').href as string) || '',
      isSelectionEmpty: currentEditor.state.selection.empty,
      isAlignLeft: currentEditor.isActive({ textAlign: 'left' }),
      isAlignCenter: currentEditor.isActive({ textAlign: 'center' }),
      isAlignRight: currentEditor.isActive({ textAlign: 'right' }),
      isHighlight: currentEditor.isActive('highlight'),
      isInTable:
        currentEditor.isActive('tableCell') || currentEditor.isActive('tableHeader'),
      canAddRowBefore: canRunCommand(currentEditor, 'addRowBefore'),
      canAddRowAfter: canRunCommand(currentEditor, 'addRowAfter'),
      canAddColumnBefore: canRunCommand(currentEditor, 'addColumnBefore'),
      canAddColumnAfter: canRunCommand(currentEditor, 'addColumnAfter'),
      canDeleteRow: canRunCommand(currentEditor, 'deleteRow'),
      canDeleteColumn: canRunCommand(currentEditor, 'deleteColumn'),
      canDeleteTable: canRunCommand(currentEditor, 'deleteTable'),
      canInsertTable: canRunCommand(currentEditor, 'insertTable'),
    }),
  })

  const groupedOptions: ToolbarOption[] = [
    {
      label: 'Heading 1',
      icon: Heading1,
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editorState.isHeading1,
    },
    {
      label: 'Heading 2',
      icon: Heading2,
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editorState.isHeading2,
    },
    {
      label: 'Heading 3',
      icon: Heading3,
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editorState.isHeading3,
      separator: true,
    },
    {
      label: 'Bold',
      icon: Bold,
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: editorState.isBold,
    },
    {
      label: 'Italic',
      icon: Italic,
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: editorState.isItalic,
    },
    {
      label: 'Underline',
      icon: Underline,
      onClick: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editorState.isUnderline,
    },
    {
      label: 'Strike',
      icon: Strikethrough,
      onClick: () => editor.chain().focus().toggleStrike().run(),
      isActive: editorState.isStrike,
    },
    {
      label: 'Highlight',
      icon: Highlighter,
      onClick: () => editor.chain().focus().toggleHighlight().run(),
      isActive: editorState.isHighlight,
      separator: true,
    },
    {
      label: 'Align text',
      icon: TextAlignJustify,
      onClick: () => {},
      isActive: editorState.isAlignLeft || editorState.isAlignCenter || editorState.isAlignRight,
      children: [
        {
          label: 'Align Left',
          icon: AlignLeft,
          onClick: () => editor.chain().focus().setTextAlign('left').run(),
          isActive: editorState.isAlignLeft,
        },
        {
          label: 'Align Center',
          icon: AlignCenter,
          onClick: () => editor.chain().focus().setTextAlign('center').run(),
          isActive: editorState.isAlignCenter,
        },
        {
          label: 'Align Right',
          icon: AlignRight,
          onClick: () => editor.chain().focus().setTextAlign('right').run(),
          isActive: editorState.isAlignRight,
        },
      ],
      separator: true,
    },
    {
      label: 'List items',
      icon: List,
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editorState.isBulletList,
      separator: true,
      children: [
        {
          label: 'Bullet List',
          icon: List,
          onClick: () => editor.chain().focus().toggleBulletList().run(),
          isActive: editorState.isBulletList,
        },
        {
          label: 'Numbered List',
          icon: ListOrdered,
          onClick: () => editor.chain().focus().toggleOrderedList().run(),
          isActive: editorState.isOrderedList,
        },
        {
          label: 'Todo',
          icon: ListTodo,
          onClick: () => editor.chain().focus().toggleTaskList().run(),
          isActive: editorState.isTaskList,
        },
      ],
    },
    {
      label: 'Insert',
      icon: Plus,
      onClick: () => {},
      children: [
        {
          label: 'Image',
          icon: ImageIcon,
          onClick: () => editor.chain().focus().insertImageLayout({ layout: 'single' }).run(),
        },
        {
          label: 'Divider',
          icon: Minus,
          onClick: () => editor.chain().focus().setHorizontalRule().run(),
        },
        {
          label: 'Link',
          icon: Link2,
          onClick: () => {
            if (!editor.state.selection.empty) {
              setLinkDialogOpen(true)
            }
          },
          disabled: editorState.isSelectionEmpty,
          isActive: !editorState.isSelectionEmpty && editorState.isLink,
        },
        {
          label: 'YouTube',
          icon: Play,
          onClick: () => setYoutubeDialogOpen(true),
        },
        {
          label: 'Blockquote',
          icon: TextQuote,
          onClick: () => editor.chain().focus().toggleBlockquote().run(),
          isActive: editorState.isBlockquote,
        },
        {
          label: 'Table',
          icon: Table2,
          onClick: () => editor.chain().focus().insertTable().run(),
          disabled: !editorState.canInsertTable,
          isActive: editorState.isInTable,
        },
      ],
    },
  ]

  return (
    <div
      onMouseDown={preventToolbarFocusLoss}
      className={cn(
        'flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto scrollbar-hide overscroll-none',
        !bare &&
          'rounded-2xl border bg-card/90 px-2 backdrop-blur-md dark:bg-card/80',
        className,
      )}
    >
      {groupedOptions.map((option) => (
        <RenderToolbarOption
          key={option.label}
          option={option}
          editor={editor}
          dropdownContentProps={dropdownContentProps}
        />
      ))}
      {editorState.isInTable && (
        <>
          <Separator orientation="vertical" className="mx-1.5 h-5!" />
          <UpdateTableOptions
            editor={editor}
            visible={editorState.isInTable}
            canAddRowBefore={editorState.canAddRowBefore}
            canAddRowAfter={editorState.canAddRowAfter}
            canDeleteRow={editorState.canDeleteRow}
            canAddColumnBefore={editorState.canAddColumnBefore}
            canAddColumnAfter={editorState.canAddColumnAfter}
            canDeleteColumn={editorState.canDeleteColumn}
            canDeleteTable={editorState.canDeleteTable}
            dropdownContentProps={dropdownContentProps}
          />
        </>
      )}
      <LinkInsertDialog
        editor={editor}
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        initialHref={editorState.linkHref}
        hasLink={editorState.isLink}
      />
      <YoutubeEmbedDialog
        editor={editor}
        open={youtubeDialogOpen}
        onOpenChange={setYoutubeDialogOpen}
      />
    </div>
  )
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
  editor,
}: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  children: React.ReactNode
  title?: string
  editor: Editor
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onMouseDown={(event) => {
        event.preventDefault()
        if (!disabled) {
          onClick()
          queueMicrotask(() => {
            if (!editor.isDestroyed) {
              editor.view.focus()
            }
          })
        }
      }}
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

type ToolbarDropdownContentProps = ReturnType<typeof getToolbarDropdownContentProps>

function RenderToolbarOption({
  option,
  editor,
  dropdownContentProps,
}: {
  option: ToolbarOption
  editor: Editor
  dropdownContentProps: ToolbarDropdownContentProps
}) {
  const Icon = option.icon

  if (!option.children) {
    return (
      <React.Fragment key={option.label}>
        <ToolbarButton
          onClick={option.onClick}
          disabled={option.disabled}
          isActive={option.isActive}
          title={option.label}
          editor={editor}
        >
          <Icon className="size-4" />
        </ToolbarButton>
        {option.separator && (
          <Separator orientation="vertical" className="mx-1.5 h-5!" />
        )}
      </React.Fragment>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={option.label}
          onMouseDown={preventToolbarFocusLoss}
          className={cn(
            'size-7 text-muted-foreground hover:text-foreground',
            option.isActive && 'bg-accent/50 text-foreground',
          )}
        >
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      {option.separator && (
        <Separator orientation="vertical" className="mx-1.5 h-5!" />
      )}
      <DropdownMenuContent {...dropdownContentProps}>
        {option.children.map((child) => (
          <DropdownMenuItem
            disabled={child.disabled}
            onSelect={runToolbarCommand(editor, child.onClick)}
            key={child.label}
          >
            <child.icon className="size-4" /> {child.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UpdateTableOptions(data: {
  editor: Editor
  visible: boolean
  canAddRowBefore: boolean
  canAddRowAfter: boolean
  canDeleteRow: boolean
  canAddColumnBefore: boolean
  canAddColumnAfter: boolean
  canDeleteColumn: boolean
  canDeleteTable: boolean
  dropdownContentProps: ToolbarDropdownContentProps
}) {
  const {
    editor,
    visible,
    canAddRowBefore,
    canAddRowAfter,
    canDeleteRow,
    canAddColumnBefore,
    canAddColumnAfter,
    canDeleteColumn,
    canDeleteTable,
    dropdownContentProps,
  } = data
  const [open, setOpen] = useState(false)

  if (!visible && !open) {
    return null
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Table"
          onMouseDown={preventToolbarFocusLoss}
          className="size-7 text-muted-foreground hover:text-foreground"
        >
          <Table2 className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...dropdownContentProps}>
        <DropdownMenuLabel>Rows</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={!canAddRowBefore}
          onSelect={runToolbarCommand(editor, () => editor.chain().focus().addRowBefore().run())}
        >
          Add row above
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canAddRowAfter}
          onSelect={runToolbarCommand(editor, () => editor.chain().focus().addRowAfter().run())}
        >
          Add row below
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canDeleteRow}
          onSelect={runToolbarCommand(editor, () => editor.chain().focus().deleteRow().run())}
        >
          Delete row
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={!canAddColumnBefore}
          onSelect={runToolbarCommand(editor, () =>
            editor.chain().focus().addColumnBefore().run(),
          )}
        >
          Add column left
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canAddColumnAfter}
          onSelect={runToolbarCommand(editor, () =>
            editor.chain().focus().addColumnAfter().run(),
          )}
        >
          Add column right
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canDeleteColumn}
          onSelect={runToolbarCommand(editor, () =>
            editor.chain().focus().deleteColumn().run(),
          )}
        >
          Delete column
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!canDeleteTable}
          onSelect={runToolbarCommand(editor, () => editor.chain().focus().deleteTable().run())}
        >
          Delete table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
