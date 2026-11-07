import { Extension } from "@tiptap/core"
import { ReactRenderer, posToDOMRect } from "@tiptap/react"
import Suggestion from "@tiptap/suggestion"
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { computePosition, flip, shift } from "@floating-ui/dom"
import {
  BadgeCheck,
  Clock,
  FileText,
  FolderTree,
  Globe,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  LayoutDashboard,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Table,
  TextQuote,
} from "lucide-react"
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion"
import type { Editor, Range } from "@tiptap/core"
import { cn } from "@/lib/utils"

// Block item type
interface BlockItem {
  title: string
  description: string
  icon: React.ReactNode
  command: (editor: Editor, range: Range) => void
}

const deleteSlashQuery = (editor: Editor, range: Range) => {
  editor.chain().focus().deleteRange(range).run()
}

const BASIC_BLOCKS: Array<BlockItem> = [
  {
    title: "Heading 1",
    description: "Main title",
    icon: <Heading1 className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().setNode("heading").run()
    },
  },
  {
    title: "Heading 2",
    description: "Subtitle",
    icon: <Heading2 className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().setNode("heading", { level: 2 }).run()
    },
  },
  {
    title: "Heading 3",
    description: "Subsubtitle",
    icon: <Heading3 className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().setNode("heading", { level: 3 }).run()
    },
  },
  {
    title: "Bullet List",
    description: "List of items",
    icon: <List className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().toggleBulletList().run()
    },
  },
  {
    title: "Numbered List",
    description: "Numbered list of items",
    icon: <ListOrdered className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().toggleOrderedList().run()
    },
  },
  {
    title: "Todo",
    description: "Todo list of items",
    icon: <ListTodo className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().toggleTaskList().run()
    },
  },
  {
    title: "Media",
    description: "Insert image, video, YouTube, or audio",
    icon: <ImageIcon className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertMediaBlock({ type: "image" }).run()
    },
  },
  {
    title: "Card",
    description: "Structured concept or reference card",
    icon: <Sparkles className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertCardBlock().run()
    },
  },
  {
    title: "Moodboard",
    description: "Visual reference grid board",
    icon: <LayoutDashboard className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertMoodboardBlock().run()
    },
  },
  {
    title: "Palette",
    description: "Color swatches with hex and role",
    icon: <Palette className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertPaletteBlock().run()
    },
  },
  {
    title: "Timeline",
    description: "Narrative beats and scene pacing",
    icon: <Clock className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertTimelineBlock().run()
    },
  },
  {
    title: "Properties",
    description: "Compact key-value metadata",
    icon: <SlidersHorizontal className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertPropertiesBlock().run()
    },
  },
  {
    title: "Attributes",
    description: "Detailed attribute explanations",
    icon: <FileText className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertAttributesBlock().run()
    },
  },
  {
    title: "Tree",
    description: "Hierarchy structure and dependencies",
    icon: <FolderTree className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertTreeBlock().run()
    },
  },
  {
    title: "Sources",
    description: "Web links and research references",
    icon: <Globe className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertSourcesBlock().run()
    },
  },
  {
    title: "Badge",
    description: "Inline status badge pill",
    icon: <BadgeCheck className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor
        .chain()
        .focus()
        .insertInlineBadge({ label: "Approved", color: "highlight" })
        .run()
    },
  },
  {
    title: "Table",
    description: "Table of data",
    icon: <Table className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().insertTable().run()
    },
  },
  {
    title: "Blockquote",
    description: "Blockquote text",
    icon: <TextQuote className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().toggleBlockquote().run()
    },
  },
  {
    title: "Divider",
    description: "Insert divider",
    icon: <Minus className="size-4" />,
    command: (editor, range) => {
      deleteSlashQuery(editor, range)
      editor.chain().focus().setHorizontalRule().run()
    },
  },
]

// Props for the command list component
type CommandListProps = SuggestionProps<BlockItem>

type CommandListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

// Command list component
const CommandList = forwardRef<CommandListRef, CommandListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const menuRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

    const selectItem = (index: number) => {
      const item = props.items[index]
      props.command(item)
    }

    const upHandler = () => {
      const newIndex = Math.max(0, selectedIndex - 1)
      if (newIndex === selectedIndex) return
      setSelectedIndex(newIndex)
      scrollToItem(newIndex)
    }

    const downHandler = () => {
      const newIndex = Math.min(props.items.length - 1, selectedIndex + 1)
      if (newIndex === selectedIndex) return
      setSelectedIndex(newIndex)
      scrollToItem(newIndex)
    }

    const enterHandler = () => {
      selectItem(selectedIndex)
    }

    const scrollToItem = (index: number) => {
      const item = itemRefs.current[index]
      const menu = menuRef.current
      if (!item || !menu) return

      const itemTop = item.offsetTop
      const itemBottom = itemTop + item.offsetHeight
      const visibleTop = menu.scrollTop
      const visibleBottom = visibleTop + menu.clientHeight

      if (itemTop < visibleTop) {
        menu.scrollTop = itemTop
      } else if (itemBottom > visibleBottom) {
        menu.scrollTop = itemBottom - menu.clientHeight
      }
    }

    useEffect(() => {
      setSelectedIndex(0)
      if (menuRef.current) {
        menuRef.current.scrollTop = 0
      }
    }, [props.items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowUp") {
          upHandler()
          return true
        }

        if (event.key === "ArrowDown") {
          downHandler()
          return true
        }

        if (event.key === "Enter") {
          enterHandler()
          return true
        }

        return false
      },
    }))

    return (
      <div
        className="flex max-h-70 w-60 flex-col overflow-y-auto rounded-2xl border border-border bg-background p-1 text-foreground drop-shadow-2xl"
        ref={menuRef}
      >
        {props.items.length ? (
          props.items.map((item, index) => (
            <button
              key={item.title}
              type="button"
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              onMouseDown={(event) => {
                // Prevent editor blur, which closes the suggestion before click fires.
                event.preventDefault()
                selectItem(index)
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "flex items-center gap-4 rounded-xl px-1 py-2 text-left text-foreground",
                index === selectedIndex && "bg-muted",
              )}
            >
              <div className="text-muted-foreground">{item.icon}</div>
              <div className="flex flex-1 flex-col items-start">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  {item.description}
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            No results
          </div>
        )}
      </div>
    )
  },
)

CommandList.displayName = "CommandList"

// Update position helper
const updatePosition = (editor: Editor, element: HTMLElement) => {
  const virtualElement = {
    getBoundingClientRect: () =>
      posToDOMRect(
        editor.view,
        editor.state.selection.from,
        editor.state.selection.to,
      ),
  }

  computePosition(virtualElement, element, {
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [shift(), flip()],
  }).then(({ x, y }) => {
    element.style.position = "fixed"
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

// Slash command extension
export const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor
          range: Range
          props: BlockItem
        }) => {
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
          return BASIC_BLOCKS.filter(
            (item) =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.description.toLowerCase().includes(query.toLowerCase()),
          ).slice(0, 10)
        },
        render: () => {
          let component: ReactRenderer<
            CommandListRef,
            CommandListProps
          > | null = null
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

              component.element.style.position = "fixed"
              component.element.style.zIndex = "50"

              document.body.appendChild(component.element)

              updatePosition(props.editor, component.element)

              // Update position on scroll
              scrollHandler = () => {
                if (component) {
                  updatePosition(props.editor, component.element)
                }
              }
              window.addEventListener("scroll", scrollHandler, true)
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
              if (props.event.key === "Escape") {
                component?.destroy()
                return true
              }

              return component?.ref?.onKeyDown(props) ?? false
            },

            onExit() {
              if (scrollHandler) {
                window.removeEventListener("scroll", scrollHandler, true)
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
