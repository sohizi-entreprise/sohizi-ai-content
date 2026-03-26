import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion'
import { TextSelection } from '@tiptap/pm/state'
import { forwardRef, useEffect, useImperativeHandle, useState, useRef } from 'react'
import { computePosition, flip, shift } from '@floating-ui/dom'
import { posToDOMRect } from '@tiptap/react'
import type { Editor, Range } from '@tiptap/core'
import {
  IconMovie,
  IconRun,
  IconMessage,
  IconArrowRight,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { v4 as uuid } from 'uuid'
import { cn } from '@/lib/utils'

// Block item type
interface BlockItem {
  title: string
  description: string
  shortcut: string
  icon: React.ReactNode
  command: (editor: Editor, range: Range) => void
}

type SceneContext = {
  scenePos: number
  sceneEndPos: number
  currentSceneChildPos: number
  currentSceneChildText: string
  currentSceneChildNodeSize: number
  existingTransitionPos: number | null
}

const getSceneContext = (editor: Editor): SceneContext | null => {
  const { $from } = editor.state.selection

  let sceneDepth: number | null = null

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth).type.name === 'scene') {
      sceneDepth = depth
      break
    }
  }

  if (sceneDepth === null || sceneDepth + 1 > $from.depth) {
    return null
  }

  const sceneNode = $from.node(sceneDepth)
  const scenePos = $from.before(sceneDepth)
  const sceneContentStart = scenePos + 1
  const sceneEndPos = scenePos + sceneNode.nodeSize - 1
  const currentSceneChildPos = $from.before(sceneDepth + 1)
  const currentSceneChildNodeSize = $from.node(sceneDepth + 1).nodeSize

  let existingTransitionPos: number | null = null

  sceneNode.forEach((child, offset) => {
    if (child.type.name === 'transition') {
      existingTransitionPos = sceneContentStart + offset
    }
  })

  return {
    scenePos,
    sceneEndPos,
    currentSceneChildPos,
    currentSceneChildText: $from.node(sceneDepth + 1).textContent,
    currentSceneChildNodeSize,
    existingTransitionPos,
  }
}

const deleteSlashQuery = (editor: Editor, range: Range) => {
  editor.chain().focus().deleteRange(range).run()
}

const insertBlockIntoScene = (
  editor: Editor,
  blockType: 'action' | 'dialogue',
) => {
  const sceneContext = getSceneContext(editor)

  if (!sceneContext) {
    return editor.chain().focus().setNode(blockType).run()
  }

  const { state, view } = editor
  const { schema } = state
  const nodeType = schema.nodes[blockType]
  const node = nodeType?.createAndFill({ id: uuid() })

  if (!node) {
    return false
  }

  const currentNodeIsEmpty = sceneContext.currentSceneChildText.trim().length === 0
  let insertPos = sceneContext.currentSceneChildPos
  let tr = state.tr

  if (currentNodeIsEmpty) {
    tr = tr.delete(
      sceneContext.currentSceneChildPos,
      sceneContext.currentSceneChildPos + sceneContext.currentSceneChildNodeSize,
    )
  } else {
    insertPos =
      sceneContext.currentSceneChildPos + sceneContext.currentSceneChildNodeSize
  }

  if (
    sceneContext.existingTransitionPos !== null &&
    insertPos > sceneContext.existingTransitionPos
  ) {
    insertPos = sceneContext.existingTransitionPos
  }

  tr = tr.insert(insertPos, node)
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)))
  view.dispatch(tr)

  return true
}

const insertTransitionIntoScene = (editor: Editor) => {
  const sceneContext = getSceneContext(editor)

  if (!sceneContext) {
    return editor.chain().focus().setNode('transition').run()
  }

  if (sceneContext.existingTransitionPos !== null) {
    toast('A transition should always be the last element of a scene.')
    return false
  }

  const { state, view } = editor
  const node = state.schema.nodes.transition?.createAndFill({ id: uuid() })

  if (!node) {
    return false
  }

  const tr = state.tr.insert(sceneContext.sceneEndPos, node)
  tr.setSelection(TextSelection.near(tr.doc.resolve(sceneContext.sceneEndPos + 1)))
  view.dispatch(tr)

  return true
}

// Define available blocks with keyboard shortcuts
const BLOCKS: BlockItem[] = [
  {
    title: 'Slugline',
    description: 'INT./EXT. LOCATION - TIME',
    shortcut: '⌘1',
    icon: <IconMovie className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)

      if (getSceneContext(editor)) {
        editor.commands.addSceneAfter()
        return
      }

      editor.chain().focus().setNode('slugline').run()
    },
  },
  {
    title: 'Action',
    description: 'Describe what happens',
    shortcut: '⌘2',
    icon: <IconRun className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      insertBlockIntoScene(editor, 'action')
    },
  },
  {
    title: 'Dialogue',
    description: 'Character speech',
    shortcut: '⌘3',
    icon: <IconMessage className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      insertBlockIntoScene(editor, 'dialogue')
    },
  },
  {
    title: 'Transition',
    description: 'CUT TO, FADE OUT, etc.',
    shortcut: '⌘4',
    icon: <IconArrowRight className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      insertTransitionIntoScene(editor)
    },
  }
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
    <div className="bg-white border border-gray-200 drop-shadow-2xl rounded-lg p-1 w-70 flex flex-col min-h-60" ref={menuRef}>
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={item.title}
            ref={(el) => { itemRefs.current[index] = el }}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              'flex items-center px-1 py-2 rounded gap-4',
              index === selectedIndex && 'bg-primary/20'
            )}
          >
            <div className="text-gray-400">
              {item.icon}
            </div>
            <div className="flex flex-col flex-1 items-start">
              <span className="text-sm font-medium text-black">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </div>
            <span className="bg-gray-200 text-sm rounded text-muted-foreground py-[2px] px-1">
              {item.shortcut}
            </span>
          </button>
        ))
      ) : (
        <div className="text-black text-center p-4">No results</div>
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
