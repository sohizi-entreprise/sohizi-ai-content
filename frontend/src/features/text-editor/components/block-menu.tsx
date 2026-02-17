import { useEffect, useRef, useState } from 'react'
import { BLOCK_METADATA, type BlockType } from '../store/types'
import { cn } from '@/lib/utils'
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

type BlockMenuProps = {
  position: { x: number; y: number }
  onSelect: (type: string) => void
  onClose: () => void
}

const BLOCK_ICONS: Record<BlockType, React.ReactNode> = {
  'scene-heading': <IconMovie className="size-4" />,
  'action': <IconRun className="size-4" />,
  'character': <IconUser className="size-4" />,
  'dialogue': <IconMessage className="size-4" />,
  'parenthetical': <IconMoodSmile className="size-4" />,
  'transition': <IconArrowRight className="size-4" />,
  'shot': <IconCamera className="size-4" />,
  'note': <IconNote className="size-4" />,
  'page-break': <IconSeparator className="size-4" />,
}

const BLOCK_ORDER: BlockType[] = [
  'scene-heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
  'note',
  'page-break',
]

// Estimated menu height (search input + 9 items + footer)
const MENU_HEIGHT = 420

export function BlockMenu({ position, onSelect, onClose }: BlockMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filter, setFilter] = useState('')
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredBlocks = BLOCK_ORDER.filter((type) => {
    const meta = BLOCK_METADATA[type]
    return (
      meta.label.toLowerCase().includes(filter.toLowerCase()) ||
      meta.description.toLowerCase().includes(filter.toLowerCase())
    )
  })

  // Calculate position on mount to ensure menu is fully visible
  useEffect(() => {
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const menuWidth = 288 // w-72 = 18rem = 288px
    
    let newX = position.x
    let newY = position.y
    
    // Check if menu would overflow horizontally
    if (position.x + menuWidth > viewportWidth) {
      newX = viewportWidth - menuWidth - 16
    }
    
    // Check if menu would overflow vertically
    if (position.y + MENU_HEIGHT > viewportHeight) {
      // Position above the cursor instead
      newY = Math.max(16, position.y - MENU_HEIGHT - 24) // 24px for line height
    }
    
    setAdjustedPosition({ x: newX, y: newY })
  }, [position])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredBlocks.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredBlocks.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (filteredBlocks[selectedIndex]) {
            onSelect(filteredBlocks[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredBlocks, selectedIndex, onSelect, onClose])

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [filter])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 bg-popover border border-white/10 rounded-lg shadow-xl overflow-hidden"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Search input */}
      <div className="p-2 border-b border-white/10">
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search blocks..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Block list */}
      <div className="max-h-80 overflow-y-auto py-1">
        {filteredBlocks.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No blocks found
          </div>
        ) : (
          filteredBlocks.map((type, index) => {
            const meta = BLOCK_METADATA[type]
            return (
              <button
                key={type}
                onClick={() => onSelect(type)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'w-full flex items-start gap-3 px-3 py-2 text-left transition-colors',
                  index === selectedIndex
                    ? 'bg-white/10'
                    : 'hover:bg-white/5'
                )}
              >
                <div className="shrink-0 mt-0.5 text-muted-foreground">
                  {BLOCK_ICONS[type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {meta.shortcut}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {meta.description}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-white/10 text-xs text-muted-foreground">
        <span className="mr-2">↑↓ Navigate</span>
        <span className="mr-2">↵ Select</span>
        <span>Esc Close</span>
      </div>
    </div>
  )
}
