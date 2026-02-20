import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion'
import { forwardRef, useEffect, useImperativeHandle, useState, useRef } from 'react'
import { computePosition, flip, shift } from '@floating-ui/dom'
import { posToDOMRect } from '@tiptap/react'
import type { Editor, Range } from '@tiptap/core'
import {
  IconMovie,
  IconRun,
  IconUser,
  IconMessage,
  IconMoodSmile,
  IconArrowRight,
  IconCamera,
  IconNote,
  IconSeparator,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

// Block item type
interface BlockItem {
  title: string
  description: string
  shortcut: string
  icon: React.ReactNode
  command: (editor: Editor, range: Range) => void
}

// Define available blocks with keyboard shortcuts
const BLOCKS: BlockItem[] = [
  {
    title: 'Scene Heading',
    description: 'INT./EXT. LOCATION - TIME',
    shortcut: '⌘1',
    icon: <IconMovie className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('sceneHeading').run()
    },
  },
  {
    title: 'Action',
    description: 'Describe what happens',
    shortcut: '⌘2',
    icon: <IconRun className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('action').run()
    },
  },
  {
    title: 'Character',
    description: 'Character name (@ mention)',
    shortcut: '⌘3',
    icon: <IconUser className="size-4" />,
    command: (editor, range) => {
      // Use setCharacter which auto-triggers @ mention
      editor.chain().focus().deleteRange(range).setCharacter().run()
    },
  },
  {
    title: 'Dialogue',
    description: 'Character speech',
    shortcut: '⌘4',
    icon: <IconMessage className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('dialogue').run()
    },
  },
  {
    title: 'Parenthetical',
    description: 'Acting direction',
    shortcut: '⌘5',
    icon: <IconMoodSmile className="size-4" />,
    command: (editor, range) => {
      // Use setParenthetical which inserts () and positions cursor
      editor.chain().focus().deleteRange(range).setParenthetical().run()
    },
  },
  {
    title: 'Transition',
    description: 'CUT TO, FADE OUT, etc.',
    shortcut: '⌘6',
    icon: <IconArrowRight className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('transition').run()
    },
  },
  {
    title: 'Shot',
    description: 'Camera direction',
    shortcut: '⌘7',
    icon: <IconCamera className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('shot').run()
    },
  },
  {
    title: 'Note',
    description: "Writer's note",
    shortcut: '⌘8',
    icon: <IconNote className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('note').run()
    },
  },
  {
    title: 'Page Break',
    description: 'Insert page break',
    shortcut: '⌘9',
    icon: <IconSeparator className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertContent({ type: 'pageBreak' }).run()
    },
  },
]

// Props for the command list component
type CommandListProps = SuggestionProps<BlockItem>

type CommandListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

// Command list component
const CommandList = forwardRef<CommandListRef, CommandListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command(item)
    }
  }

  const upHandler = () => {
    const newIndex = (selectedIndex + props.items.length - 1) % props.items.length
    setSelectedIndex(newIndex)
    scrollToItem(newIndex)
  }

  const downHandler = () => {
    const newIndex = (selectedIndex + 1) % props.items.length
    setSelectedIndex(newIndex)
    scrollToItem(newIndex)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  // Scroll the selected item into view
  const scrollToItem = (index: number) => {
    const item = itemRefs.current[index]
    if (item && menuRef.current) {
      item.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => setSelectedIndex(0), [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter') {
        enterHandler()
        return true
      }

      return false
    },
  }))

  return (
    <div className="slash-command-menu" ref={menuRef}>
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={item.title}
            ref={(el) => { itemRefs.current[index] = el }}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              'slash-command-item',
              index === selectedIndex && 'is-selected'
            )}
          >
            <div className="slash-command-left">
              <div className="slash-command-icon">
                {item.icon}
              </div>
              <div className="slash-command-content">
                <span className="slash-command-title">{item.title}</span>
                <span className="slash-command-description">{item.description}</span>
              </div>
            </div>
            <span className="slash-command-shortcut">
              {item.shortcut}
            </span>
          </button>
        ))
      ) : (
        <div className="slash-command-empty">No results</div>
      )}
    </div>
  )
})

CommandList.displayName = 'CommandList'

// Update position helper
const updatePosition = (editor: Editor, element: HTMLElement) => {
  const virtualElement = {
    getBoundingClientRect: () => posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to),
  }

  computePosition(virtualElement, element, {
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [shift(), flip()],
  }).then(({ x, y }) => {
    element.style.position = 'fixed'
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

// Slash command extension
export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: BlockItem }) => {
          props.command(editor, range)
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return BLOCKS.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 10)
        },
        render: () => {
          let component: ReactRenderer<CommandListRef, CommandListProps> | null = null
          let scrollHandler: (() => void) | null = null

          return {
            onStart: (props: SuggestionProps<BlockItem>) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              })

              if (!props.clientRect) {
                return
              }

              component.element.style.position = 'fixed'
              component.element.style.zIndex = '50'

              document.body.appendChild(component.element)

              updatePosition(props.editor, component.element)

              // Update position on scroll
              scrollHandler = () => {
                if (component) {
                  updatePosition(props.editor, component.element)
                }
              }
              window.addEventListener('scroll', scrollHandler, true)
            },

            onUpdate(props: SuggestionProps<BlockItem>) {
              component?.updateProps(props)

              if (!props.clientRect) {
                return
              }

              if (component) {
                updatePosition(props.editor, component.element)
              }
            },

            onKeyDown(props: SuggestionKeyDownProps) {
              if (props.event.key === 'Escape') {
                component?.destroy()
                return true
              }

              return component?.ref?.onKeyDown(props) ?? false
            },

            onExit() {
              if (scrollHandler) {
                window.removeEventListener('scroll', scrollHandler, true)
                scrollHandler = null
              }
              component?.destroy()
              component = null
            },
          }
        },
      }),
    ]
  },
})
