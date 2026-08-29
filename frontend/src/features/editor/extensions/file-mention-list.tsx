import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from '@tiptap/suggestion'
import type { FileMentionItem } from '@/hooks/use-file-mention-search'

type FileMentionListProps = SuggestionProps<FileMentionItem>

type FileMentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export const FileMentionList = forwardRef<
  FileMentionListRef,
  FileMentionListProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]
    props.command(item)
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
            {item.display}
          </button>
        ))
      ) : (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          No files found
        </div>
      )}
    </div>
  )
})
