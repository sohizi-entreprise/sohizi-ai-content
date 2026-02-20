import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { computePosition, flip, shift } from '@floating-ui/dom'
import { Editor, posToDOMRect, ReactRenderer } from '@tiptap/react'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'

type MentionListProps = SuggestionProps<string>

type MentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]

    if (item) {
      props.command({ id: item })
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
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
    <div className="dropdown-menu">
      {props.items.length ? (
        props.items.map((item: string, index: number) => (
          <button
            className={index === selectedIndex ? 'is-selected' : ''}
            key={index}
            onClick={() => selectItem(index)}
          >
            {item}
          </button>
        ))
      ) : (
        <div className="item">No result</div>
      )}
    </div>
  )
})

const updatePosition = (editor: Editor, element: HTMLElement) => {
  const virtualElement = {
    getBoundingClientRect: () => posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to),
  }

  computePosition(virtualElement, element, {
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [shift(), flip()],
  }).then(({ x, y }) => {
    element.style.width = 'max-content'
    element.style.position = 'fixed'
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

type SuggestionRenderProps = SuggestionProps<string>

// Helper to create a render function (reusable for both mention types)
const createRenderFunction = () => {
  return () => {
    let component: ReactRenderer<MentionListRef, MentionListProps> | null = null
    let scrollHandler: (() => void) | null = null

    return {
      onStart: (props: SuggestionRenderProps) => {
        component = new ReactRenderer(MentionList, {
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
        
        // Listen to scroll on window and any scrollable parent
        window.addEventListener('scroll', scrollHandler, true)
      },

      onUpdate(props: SuggestionRenderProps) {
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
        // Clean up scroll listener
        if (scrollHandler) {
          window.removeEventListener('scroll', scrollHandler, true)
          scrollHandler = null
        }
        component?.destroy()
        component = null
      },
    }
  }
}

// Suggestion config for @ mentions (people)
export const peopleMentionSuggestion = {
  char: '@',
  items: ({ query }: { query: string }) => {
    return [
      'Lea Thompson',
      'Cyndi Lauper',
      'Tom Cruise',
      'Madonna',
      'Jerry Hall',
      'Joan Collins',
      'Winona Ryder',
      'Christina Applegate',
      'Alyssa Milano',
      'Molly Ringwald',
      'Ally Sheedy',
      'Debbie Harry',
      'Olivia Newton-John',
      'Elton John',
      'Michael J. Fox',
      'Rose',
      'Emilio Estevez',
      'Ralph Macchio',
      'Rob Lowe',
      'Jennifer Grey',
      'Mickey Rourke',
      'John Cusack',
      'Matthew Broderick',
      'Justine Bateman',
      'Lisa Bonet',
    ]
      .filter(item => item.toLowerCase().startsWith(query.toLowerCase()))
      .slice(0, 5)
  },
  // Custom command that preserves the current block type
  command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: { id: string | null } }) => {
    // Delete the trigger text (@query) and insert the mention node
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent([
        {
          type: 'peopleMention',
          attrs: {
            id: props.id,
            label: props.id,
          },
        },
      ])
      .run()
  },
  render: createRenderFunction(),
}

// Suggestion config for # mentions (tags/movies)
export const tagMentionSuggestion = {
  char: '#',
  items: ({ query }: { query: string }) => {
    return ['Dirty Dancing', 'Pirates of the Caribbean', 'The Matrix']
      .filter(item => item.toLowerCase().startsWith(query.toLowerCase()))
      .slice(0, 5)
  },
  render: createRenderFunction(),
}