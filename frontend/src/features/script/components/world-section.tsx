import {
  getGenerateContentMutationOptions,
  getStoryBibleQueryOptions,
  saveStoryBibleMutationOptions,
} from '@/features/projects/query-mutation'
import { Button } from '@/components/ui/button'
import {
  WorldFieldNodes,
  WorldSectionHeadingNode,
  type WorldFieldNodeName,
} from '@/features/text-editor/extensions'
import '@/features/text-editor/styles/editor.css'
import type { JSONContent } from '@tiptap/react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { IconLoader2, IconRefresh } from '@tabler/icons-react'
import { useGetSSE } from '@/hooks/use-get-sse'
import { sseStoryBibleEventHandlers } from '@/features/projects/event-handlers'
import OverLayStreamingProgress from './loader-overlay'
import { TextSkeleton } from '@/features/text-editor'
import { useScriptStore } from '@/features/projects/store/script-store'


type FieldKey = string

type FieldDefinition = {
  section: string
  label: string
  key: FieldKey
}

const FIELDS: FieldDefinition[] = [
  { section: 'World', label: 'Setting', key: 'world.setting' },
  { section: 'World', label: 'Time period', key: 'world.timePeriod' },
  { section: 'World', label: 'World rules', key: 'world.worldRules' },
  { section: 'World', label: 'Social context', key: 'world.socialContext' },
  
  {
    section: 'Conflict',
    label: 'Central conflict',
    key: 'conflictEngine.centralConflict',
  },
  { section: 'Conflict', label: 'Stakes', key: 'conflictEngine.stakes' },
  {
    section: 'Conflict',
    label: 'Antagonistic force',
    key: 'conflictEngine.antagonisticForce',
  },
  {
    section: 'Conflict',
    label: 'Time pressure',
    key: 'conflictEngine.timePressure',
  },
  {
    section: 'Conflict',
    label: 'Main dramatic question',
    key: 'conflictEngine.mainDramaticQuestion',
  },
  { section: 'Tone & style', label: 'Visual style', key: 'toneAndStyle.visualStyle' },
  {
    section: 'Tone & style',
    label: 'Dialogue style',
    key: 'toneAndStyle.dialogueStyle',
  },
  { section: 'Tone & style', label: 'Pacing', key: 'toneAndStyle.pacing' },
  {
    section: 'Continuity',
    label: 'Facts to keep consistent',
    key: 'continuityRules.factsToConsistent',
  },
  {
    section: 'Continuity',
    label: 'Character behavior rules',
    key: 'continuityRules.characterBehaviorRules',
  },
  {
    section: 'Continuity',
    label: 'Things to avoid',
    key: 'continuityRules.thingsToAvoid',
  },
]

function getNodeTypeFromFieldKey(key: FieldKey): WorldFieldNodeName {
  return key.split('.')[1] as WorldFieldNodeName
}

const PLACEHOLDER_BY_NODE_TYPE = FIELDS.reduce<Record<string, string>>(
  (acc, field) => {
    acc[getNodeTypeFromFieldKey(field.key)] = `Enter ${field.label.toLowerCase()}...`
    return acc
  },
  {}
)

export default function WorldSection({ projectId }: { projectId: string }) {
  const { data: storyBibleDoc, isLoading } = useQuery(getStoryBibleQueryOptions(projectId))
  // const [doc, setDoc] = useState<JSONContent | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<JSONContent | null>(null)

  const { mutate: generateContent, isPending: isRequestPending } = useMutation(getGenerateContentMutationOptions(projectId))
  const { mutate: saveStoryBible } = useMutation(saveStoryBibleMutationOptions(projectId))
  const subscribe = useGetSSE({eventFuncMap: sseStoryBibleEventHandlers})

  const isStreaming = useScriptStore(state => state.isGenerating.storyBible)

  const handleRegenerate = () => {
    generateContent('world_bible_outline', {
      onSuccess: (data) => {
        const sseUrl = `${import.meta.env.VITE_API_BASE_URL}/stream/${data.streamId}`
        subscribe(sseUrl)
      },
    })
  }

  const flushDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (pendingRef.current) {
      saveStoryBible(pendingRef.current)
      pendingRef.current = null
    }
  }, [saveStoryBible])

  const scheduleSave = useCallback((nextDoc: JSONContent) => {
    // pendingRef.current = nextDoc
    // if (debounceRef.current) clearTimeout(debounceRef.current)
    // debounceRef.current = setTimeout(() => {
    //   debounceRef.current = null
    //   if (pendingRef.current) {
    //     saveStoryBible(pendingRef.current)
    //     pendingRef.current = null
    //   }
    // }, DEBOUNCE_MS)
  }, [saveStoryBible])

  useEffect(() => () => flushDebounce(), [flushDebounce])

  const handleDocumentChange = useCallback((nextDoc: JSONContent) => {
    scheduleSave(nextDoc)
  }, [scheduleSave])

  const disableBtn = isRequestPending || isStreaming
  const showLoader = isLoading || isStreaming

  if (!storyBibleDoc) {
    return <div className='text-white'>No story bible doc</div>
  }

  return (
    <div className="flex min-h-full flex-col items-center py-6 relative">
      <div className='max-w-[8.5in] w-full flex justify-end mb-4'>
        <Button size="sm" 
                onClick={handleRegenerate}
                disabled={disableBtn}
        >
          {
            isRequestPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />
          }
          Regenerate
        </Button>
      </div>

      {
        showLoader ? (
          <div className='space-y-6 bg-white w-[8.5in] p-[1in]'>
            <TextSkeleton />
            <TextSkeleton />
            <TextSkeleton />
            <TextSkeleton />
          </div>
        ):
        <div
          className="screenplay-page"
        >
          <WorldEditor doc={storyBibleDoc} onChange={handleDocumentChange} />
        </div>
      }

      {
        isStreaming && (
          <OverLayStreamingProgress className='absolute inset-0'>
            Streaming Progress
          </OverLayStreamingProgress>
        )
      }
    </div>
  )
}

function WorldEditor({
  doc,
  onChange,
}: {
  doc: JSONContent
  onChange: (doc: JSONContent) => void
}) {
  const lastAppliedDocRef = useRef<string>(JSON.stringify(doc))

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        paragraph: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => PLACEHOLDER_BY_NODE_TYPE[node.type.name] ?? '',
        includeChildren: true,
      }),
      WorldSectionHeadingNode,
      ...WorldFieldNodes,
    ],
    []
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: doc,
    editorProps: {
      attributes: {
        class: 'world-editor-content',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextDoc = currentEditor.getJSON()
      lastAppliedDocRef.current = JSON.stringify(nextDoc)
      onChange(nextDoc)
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    const serializedDoc = JSON.stringify(doc)
    if (serializedDoc === lastAppliedDocRef.current) {
      return
    }

    editor.commands.setContent(doc, { emitUpdate: false })
    lastAppliedDocRef.current = serializedDoc
  }, [doc, editor])

  if (!editor) {
    return null
  }

  return (
    <div className="world-editor">
      <div className="world-editor-wrapper">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
