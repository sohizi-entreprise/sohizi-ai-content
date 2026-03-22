import { getGenerateContentMutationOptions, getProjectQueryOptions } from '@/features/projects/query-mutation'
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconLoader2, IconRefresh } from '@tabler/icons-react'
import { useGetSSE } from '@/hooks/use-get-sse'
import { sseStoryBibleEventHandlers } from '@/features/projects/event-handlers'
import OverLayStreamingProgress from './loader-overlay'
import { TextSkeleton } from '@/features/text-editor'
import { useScriptStore } from '@/features/projects/store/script-store'
import { useShallow } from 'zustand/shallow'

/** Story-bible form shape (main fields only; excludes keyCharacters, keyLocations) */
type StoryBibleForm = {
  world: {
    setting: string
    timePeriod: string
    worldRules: string
    socialContext: string
  }
  conflictEngine: {
    centralConflict: string
    stakes: string
    antagonisticForce: string
    timePressure: string
    mainDramaticQuestion: string
  }
  toneAndStyle: {
    visualStyle: string
    dialogueStyle: string
    pacing: string
  }
  continuityRules: {
    factsToConsistent: string
    characterBehaviorRules: string
    thingsToAvoid: string
  }
}

const DEBOUNCE_MS = 400

const emptyForm: StoryBibleForm = {
  world: {
    setting: '',
    timePeriod: '',
    worldRules: '',
    socialContext: '',
  },
  conflictEngine: {
    centralConflict: '',
    stakes: '',
    antagonisticForce: '',
    timePressure: '',
    mainDramaticQuestion: '',
  },
  toneAndStyle: {
    visualStyle: '',
    dialogueStyle: '',
    pacing: '',
  },
  continuityRules: {
    factsToConsistent: '',
    characterBehaviorRules: '',
    thingsToAvoid: '',
  },
}

function getFormFromProject(project: { story_bible?: unknown } | null): StoryBibleForm {
  if (!project?.story_bible || typeof project.story_bible !== 'object') {
    return emptyForm
  }
  const b = project.story_bible as Record<string, unknown>
  const w = (b.world as Record<string, string> | undefined) || {}
  const c = (b.conflictEngine as Record<string, string> | undefined) || {}
  const t = (b.toneAndStyle as Record<string, string> | undefined) || {}
  const r = (b.continuityRules as Record<string, string> | undefined) || {}
  return {
    world: {
      setting: w.setting ?? '',
      timePeriod: w.timePeriod ?? '',
      worldRules: w.worldRules ?? '',
      socialContext: w.socialContext ?? '',
    },
    conflictEngine: {
      centralConflict: c.centralConflict ?? '',
      stakes: c.stakes ?? '',
      antagonisticForce: c.antagonisticForce ?? '',
      timePressure: c.timePressure ?? '',
      mainDramaticQuestion: c.mainDramaticQuestion ?? '',
    },
    toneAndStyle: {
      visualStyle: t.visualStyle ?? '',
      dialogueStyle: t.dialogueStyle ?? '',
      pacing: t.pacing ?? '',
    },
    continuityRules: {
      factsToConsistent: r.factsToConsistent ?? '',
      characterBehaviorRules: r.characterBehaviorRules ?? '',
      thingsToAvoid: r.thingsToAvoid ?? '',
    },
  }
}

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

const FIELD_BY_NODE_TYPE = FIELDS.reduce<Record<WorldFieldNodeName, FieldDefinition>>(
  (acc, field) => {
    acc[getNodeTypeFromFieldKey(field.key)] = field
    return acc
  },
  {} as Record<WorldFieldNodeName, FieldDefinition>
)

const PLACEHOLDER_BY_NODE_TYPE = FIELDS.reduce<Record<string, string>>(
  (acc, field) => {
    acc[getNodeTypeFromFieldKey(field.key)] = `Enter ${field.label.toLowerCase()}...`
    return acc
  },
  {}
)

const SECTION_ORDER = [...new Set(FIELDS.map((field) => field.section))]

function getValue(form: StoryBibleForm, key: FieldKey): string {
  const [a, b] = key.split('.')
  if (a === 'world') return (form.world as Record<string, string>)[b] ?? ''
  if (a === 'conflictEngine') return (form.conflictEngine as Record<string, string>)[b] ?? ''
  if (a === 'toneAndStyle') return (form.toneAndStyle as Record<string, string>)[b] ?? ''
  if (a === 'continuityRules') return (form.continuityRules as Record<string, string>)[b] ?? ''
  return ''
}

function setValue(form: StoryBibleForm, key: FieldKey, value: string): StoryBibleForm {
  const [a, b] = key.split('.')
  const next = { ...form }
  if (a === 'world') next.world = { ...next.world, [b]: value }
  if (a === 'conflictEngine') next.conflictEngine = { ...next.conflictEngine, [b]: value }
  if (a === 'toneAndStyle') next.toneAndStyle = { ...next.toneAndStyle, [b]: value }
  if (a === 'continuityRules') next.continuityRules = { ...next.continuityRules, [b]: value }
  return next
}

function toInlineContent(value: string): JSONContent[] | undefined {
  if (!value) return undefined

  const content: JSONContent[] = []
  const lines = value.split('\n')

  lines.forEach((line, index) => {
    if (line) {
      content.push({ type: 'text', text: line })
    }
    if (index < lines.length - 1) {
      content.push({ type: 'hardBreak' })
    }
  })

  return content.length > 0 ? content : undefined
}

function extractText(content?: JSONContent[]): string {
  if (!content?.length) return ''

  let result = ''

  for (const node of content) {
    if (node.type === 'text') {
      result += node.text ?? ''
      continue
    }
    if (node.type === 'hardBreak') {
      result += '\n'
      continue
    }
    if (node.content) {
      result += extractText(node.content)
    }
  }

  return result
}

function buildWorldDoc(form: StoryBibleForm): JSONContent {
  const content: JSONContent[] = []

  for (const section of SECTION_ORDER) {
    content.push({
      type: 'worldSectionHeading',
      attrs: { title: section },
    })

    for (const field of FIELDS.filter((item) => item.section === section)) {
      const nodeType = getNodeTypeFromFieldKey(field.key)
      content.push({
        type: nodeType,
        attrs: {
          label: field.label,
          placeholder: PLACEHOLDER_BY_NODE_TYPE[nodeType],
        },
        content: toInlineContent(getValue(form, field.key)),
      })
    }
  }

  return { type: 'doc', content }
}

function getFormFromDocument(doc: JSONContent): StoryBibleForm {
  let next = emptyForm

  for (const node of doc.content ?? []) {
    const field = FIELD_BY_NODE_TYPE[node.type as WorldFieldNodeName]
    if (!field) continue
    next = setValue(next, field.key, extractText(node.content))
  }

  return next
}

function getChangedFields(previous: StoryBibleForm, next: StoryBibleForm) {
  return FIELDS.filter((field) => getValue(previous, field.key) !== getValue(next, field.key))
}

export default function WorldSection({ projectId }: { projectId: string }) {
  const { data: project, isLoading } = useQuery(getProjectQueryOptions(projectId))
  const [form, setForm] = useState<StoryBibleForm | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<{ key: FieldKey; value: string } | null>(null)

  const {mutate: generateContent, isPending: isRequestPending} = useMutation(getGenerateContentMutationOptions(projectId))
  const subscribe = useGetSSE({eventFuncMap: sseStoryBibleEventHandlers})

  const isStreaming = useScriptStore(state => state.isGenerating.storyBible)
  const isEmpty = useScriptStore(state => !state.storyBibleOutline)

  const handleRegenerate = () => {
    generateContent('world_bible_outline', {
      onSuccess: (data) => {
        const sseUrl = `${import.meta.env.VITE_API_BASE_URL}/stream/${data.streamId}`
        subscribe(sseUrl)
      },
    })
  }

  useEffect(() => {
    if (project) setForm(getFormFromProject(project))
  }, [project])

  const flushDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (pendingRef.current) {
      console.log(pendingRef.current.key, pendingRef.current.value)
      pendingRef.current = null
    }
  }, [])

  const scheduleSave = useCallback((key: FieldKey, value: string) => {
    pendingRef.current = { key, value }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      if (pendingRef.current) {
        console.log(pendingRef.current.key, pendingRef.current.value)
        pendingRef.current = null
      }
    }, DEBOUNCE_MS)
  }, [])

  useEffect(() => () => flushDebounce(), [flushDebounce])

  const handleDocumentChange = useCallback(
    (doc: JSONContent) => {
      console.log(doc)
      const nextForm = getFormFromDocument(doc)
      setForm((previous) => {
        if (!previous) return nextForm

        for (const field of getChangedFields(previous, nextForm)) {
          scheduleSave(field.key, getValue(nextForm, field.key))
        }

        return nextForm
      })
    },
    [scheduleSave]
  )

  const disableBtn = isRequestPending || isStreaming
  const showLoader = isLoading || !form || (isStreaming && isEmpty)

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
          <WorldEditor initialForm={form} onChange={handleDocumentChange} />
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
  initialForm,
  onChange,
}: {
  initialForm: StoryBibleForm
  onChange: (doc: JSONContent) => void
}) {
  const initialDocRef = useRef<JSONContent | null>(null)

  if (!initialDocRef.current) {
    initialDocRef.current = buildWorldDoc(initialForm)
  }

  const storyBibleOutline = useScriptStore(useShallow(state => state.storyBibleOutline))
  const canSetData = useScriptStore(useShallow(state => !!state.storyBibleOutline && !state.isGenerating.storyBible))

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
    content: initialDocRef.current,
    editorProps: {
      attributes: {
        class: 'world-editor-content',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getJSON())
    },
  })

  useEffect(()=>{
    if(!canSetData || !editor) return
    const content = buildWorldDoc((storyBibleOutline as StoryBibleForm))
    editor.commands.setContent(content, {emitUpdate: false})
  }, [canSetData, editor])
  
  // useEffect(()=>{
  //   if(!storyBibleOutline || !editor) return
  //   const content = buildWorldDoc((storyBibleOutline as StoryBibleForm))
  //   editor.commands.setContent(content, {emitUpdate: false})
  // }, [storyBibleOutline, editor])

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
