import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { CommandMentionItem } from '@/hooks/use-command-mention-search'

type CommandMentionListProps = SuggestionProps<CommandMentionItem>

type CommandMentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export const CommandMentionList = forwardRef<CommandMentionListRef, CommandMentionListProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    const selectItem = (index: number) => {
      const item = props.items[index]
      if (item) {
        props.command(item)
      }
    }

    useEffect(() => setSelectedIndex(0), [props.items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex(
            (selectedIndex + props.items.length - 1) % props.items.length,
          )
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % props.items.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    return (
      <div className="rounded-lg border border-border bg-popover p-1 shadow-md">
        {props.items.length ? (
          props.items.map((item, index) => (
            <button
              key={item.id}
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-sm ${
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'text-popover-foreground hover:bg-accent/50'
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
  },
)

CommandMentionList.displayName = 'CommandMentionList'
