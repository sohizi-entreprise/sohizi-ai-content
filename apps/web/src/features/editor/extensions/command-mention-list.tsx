import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion"
import type { CommandMentionItem } from "@/hooks/use-command-mention-search"

type CommandMentionListProps = SuggestionProps<CommandMentionItem>

type CommandMentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export const CommandMentionList = forwardRef<
  CommandMentionListRef,
  CommandMentionListProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const selectItem = (index: number) => {
    const item = props.items[index]
    props.command(item)
  }

  useEffect(() => {
    setSelectedIndex(0)
    if (menuRef.current) menuRef.current.scrollTop = 0
  }, [props.items])

  useEffect(() => {
    const menu = menuRef.current
    const item = itemRefs.current[selectedIndex]
    if (!menu || !item) return

    if (item.offsetTop < menu.scrollTop) {
      menu.scrollTop = item.offsetTop
    } else if (
      item.offsetTop + item.offsetHeight >
      menu.scrollTop + menu.clientHeight
    ) {
      menu.scrollTop = item.offsetTop + item.offsetHeight - menu.clientHeight
    }
  }, [selectedIndex])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex(
          (selectedIndex + props.items.length - 1) % props.items.length,
        )
        return true
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((selectedIndex + 1) % props.items.length)
        return true
      }
      if (event.key === "Enter" && !event.shiftKey) {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  return (
    <div
      ref={menuRef}
      className="max-h-70 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
    >
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        Commands
      </div>
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              itemRefs.current[index] = element
            }}
            className={`flex w-full items-center rounded-md px-2 py-1.5 text-sm ${
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-popover-foreground hover:bg-accent/50"
            }`}
            onMouseDown={(e) => {
              e.preventDefault()
              selectItem(index)
            }}
          >
            /{item.display}
          </button>
        ))
      ) : (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          No commands found
        </div>
      )}
    </div>
  )
})

CommandMentionList.displayName = "CommandMentionList"
