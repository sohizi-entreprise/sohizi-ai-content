import { useScriptStore } from '@/features/script/store'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import SceneListPanel from './scene-list-panel'
import { ScenesEditor } from './scenes-editor'

const DEBOUNCE_MS = 400

type SceneBlock = {
  id: string
  type: 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition'
  content: string
}

type Scene = {
  id: string
  number: number
  heading: string
  description: string
  blocks: SceneBlock[]
}

const DUMMY_SCENES: Scene[] = [
  {
    id: 'scene-1',
    number: 1,
    heading: 'INT. APARTMENT - NIGHT',
    description: 'Maya discovers the recorder is still running.',
    blocks: [
      {
        id: 'block-1-1',
        type: 'scene_heading',
        content: 'INT. APARTMENT - NIGHT',
      },
      {
        id: 'block-1-2',
        type: 'action',
        content:
          'Maya steps into the dark apartment. A faint red light pulses from an old tape recorder on the kitchen counter.',
      },
      {
        id: 'block-1-3',
        type: 'action',
        content:
          'She freezes, eyes locked on the device. The reels turn slowly, capturing every sound in the room.',
      },
      {
        id: 'block-1-4',
        type: 'character',
        content: 'MAYA',
      },
      {
        id: 'block-1-5',
        type: 'parenthetical',
        content: '(whispers)',
      },
      {
        id: 'block-1-6',
        type: 'dialogue',
        content: "Who's been here?",
      },
    ],
  },
  {
    id: 'scene-2',
    number: 2,
    heading: 'EXT. ROOFTOP - DAWN',
    description: 'Maya confronts the building superintendent about the break-in.',
    blocks: [
      {
        id: 'block-2-1',
        type: 'scene_heading',
        content: 'EXT. ROOFTOP - DAWN',
      },
      {
        id: 'block-2-2',
        type: 'action',
        content:
          'The city awakens below. Maya stands near the edge, arms crossed, waiting.',
      },
      {
        id: 'block-2-3',
        type: 'action',
        content:
          'HAROLD (60s), the building super, emerges from the stairwell door, coffee in hand.',
      },
      {
        id: 'block-2-4',
        type: 'character',
        content: 'HAROLD',
      },
      {
        id: 'block-2-5',
        type: 'dialogue',
        content: "You're up early. Everything okay?",
      },
    ],
  },
  {
    id: 'scene-3',
    number: 3,
    heading: 'INT. POLICE STATION - DAY',
    description: 'Maya files a report. Gets nowhere.',
    blocks: [
      {
        id: 'block-3-1',
        type: 'scene_heading',
        content: 'INT. POLICE STATION - DAY',
      },
      {
        id: 'block-3-2',
        type: 'action',
        content:
          'Fluorescent lights buzz overhead. Maya sits across from DETECTIVE CHEN, a stack of paperwork between them.',
      },
      {
        id: 'block-3-3',
        type: 'character',
        content: 'DETECTIVE CHEN',
      },
      {
        id: 'block-3-4',
        type: 'dialogue',
        content:
          "So nothing was taken? No signs of forced entry? Ma'am, I'm not sure what you want us to do here.",
      },
    ],
  },
]

export default function ScriptSection({ 
  projectId: _projectId,
  showLayers,
  onCloseLayers,
}: { 
  projectId: string
  showLayers: boolean
  onCloseLayers: () => void
}) {
  const addSnippetContext = useScriptStore((s) => s.addSnippetContext)

  const [scenes, setScenes] = useState<Scene[]>(DUMMY_SCENES)
  const [selectedSceneId, setSelectedSceneId] = useState<string>(DUMMY_SCENES[0].id)
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null)
  const [hoveredPopover, setHoveredPopover] = useState<string | null>(null)

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<{ sceneId: string; blockId: string; content: string } | null>(null)

  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0]

  const flushDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (pendingRef.current) {
      console.log('Saving:', pendingRef.current.sceneId, pendingRef.current.blockId, pendingRef.current.content)
      pendingRef.current = null
    }
  }, [])

  const scheduleSave = useCallback((sceneId: string, blockId: string, content: string) => {
    pendingRef.current = { sceneId, blockId, content }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      if (pendingRef.current) {
        console.log('Saving:', pendingRef.current.sceneId, pendingRef.current.blockId, pendingRef.current.content)
        pendingRef.current = null
      }
    }, DEBOUNCE_MS)
  }, [])

  useEffect(() => () => flushDebounce(), [flushDebounce])
  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    },
    []
  )

  const showPopover = (blockId: string) => hoveredBlockId === blockId || hoveredPopover === blockId
  const setBlockHover = (blockId: string | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (blockId !== null) setHoveredBlockId(blockId)
    else {
      hoverTimeoutRef.current = setTimeout(() => setHoveredBlockId(null), 150)
    }
  }
  const setPopoverHover = (blockId: string | null) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredPopover(blockId)
  }

  const handleBlockChange = useCallback(
    (sceneId: string, blockId: string, content: string) => {
      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === sceneId
            ? {
                ...scene,
                blocks: scene.blocks.map((block) =>
                  block.id === blockId ? { ...block, content } : block
                ),
              }
            : scene
        )
      )
      scheduleSave(sceneId, blockId, content)
    },
    [scheduleSave]
  )

  const handleAddToContext = useCallback(
    (block: SceneBlock) => {
      addSnippetContext({
        content: block.content,
        sourceBlockId: block.id,
        sourceBlockType: 'snippet',
      })
    },
    [addSnippetContext]
  )

  const handleRegenerate = () => {
    console.log('Regenerate script (not implemented)')
  }

  const handleAddScene = () => {
    const newSceneNumber = scenes.length + 1
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      number: newSceneNumber,
      heading: 'INT. NEW LOCATION - DAY',
      description: 'New scene description...',
      blocks: [
        {
          id: `block-new-${Date.now()}`,
          type: 'scene_heading',
          content: 'INT. NEW LOCATION - DAY',
        },
        {
          id: `block-new-${Date.now()}-action`,
          type: 'action',
          content: 'Start writing your scene here...',
        },
      ],
    }
    setScenes((prev) => [...prev, newScene])
    setSelectedSceneId(newScene.id)
  }

  return (
    <div className="relative h-full">
      {/* Scene List Overlay Panel */}
      {showLayers && (
        <SceneListPanel
          scenes={scenes}
          selectedSceneId={selectedSceneId}
          onSelectScene={setSelectedSceneId}
          onAddScene={handleAddScene}
          onClose={onCloseLayers}
        />
      )}

      {/* Center - Script Canvas */}
      <div className="h-full overflow-y-auto overscroll-none">
        <div className="flex min-h-full flex-col items-center py-6">
          {/* Top bar with regenerate button */}
          <div className="mb-4 flex w-full max-w-[595px] justify-between items-center px-4">
            <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <IconRefresh className="mr-1.5 size-4" />
                Regenerate
            </Button>
          </div>

          {/* A4 Paper Canvas */}
          <ScenesEditor 
            className="min-h-full w-full"
            onChange={(content) => {
              console.log('Editor content changed:', content)
            }}
          />
        </div>
      </div>
    </div>
  )
}

function SceneBlockRow({
  block,
  isPopoverOpen,
  onBlockHover,
  onPopoverHover,
  onChange,
  onAddToContext,
}: {
  block: SceneBlock
  sceneId: string
  isPopoverOpen: boolean
  onBlockHover: (hovered: boolean) => void
  onPopoverHover: (hovered: boolean) => void
  onChange: (content: string) => void
  onAddToContext: () => void
}) {
  const getBlockStyles = (type: SceneBlock['type']) => {
    switch (type) {
      case 'scene_heading':
        return 'font-mono text-sm font-bold uppercase tracking-wide'
      case 'action':
        return 'font-mono text-sm'
      case 'character':
        return 'font-mono text-sm font-bold uppercase text-center ml-[40%]'
      case 'dialogue':
        return 'font-mono text-sm ml-[25%] mr-[25%]'
      case 'parenthetical':
        return 'font-mono text-sm italic ml-[30%] mr-[30%]'
      case 'transition':
        return 'font-mono text-sm uppercase text-right'
      default:
        return 'font-mono text-sm'
    }
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={(open) => !open && onPopoverHover(false)}>
      <PopoverAnchor asChild>
        <div
          className="group/block relative"
          onMouseEnter={() => onBlockHover(true)}
          onMouseLeave={() => onBlockHover(false)}
        >
          <textarea
            aria-label={block.type}
            className={cn(
              'min-h-[40px] w-full resize-y border-0 bg-transparent py-1 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0',
              getBlockStyles(block.type)
            )}
            placeholder={`Enter ${block.type.replace('_', ' ')}...`}
            value={block.content}
            onChange={(e) => onChange(e.target.value)}
            rows={block.type === 'action' ? 3 : 1}
          />
          <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover/block:opacity-100">
            <span className="text-[10px] text-zinc-400">Add to AI context</span>
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        sideOffset={6}
        className="w-auto p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={() => onPopoverHover(true)}
        onMouseLeave={() => onPopoverHover(false)}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={onAddToContext}
        >
          Add to AI context
        </Button>
      </PopoverContent>
    </Popover>
  )
}
