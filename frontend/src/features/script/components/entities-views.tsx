import {RefObject, useEffect, useRef, useState} from 'react'
import { cn } from '@/lib/utils'
import { IconMapPin, IconBox } from '@tabler/icons-react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { CharacterFieldNodes, LocationFieldNodes, PropFieldNodes } from '@/features/text-editor/extensions'
import type { Editor, JSONContent } from '@tiptap/react'
import '@/features/text-editor/styles/editor.css'
import { CharacterEntity, LocationEntity, PropEntity } from '@/features/projects/type'
import { buildCharacterDoc, buildLocationDoc, buildPropDoc, CHARACTER_FIELDS, getCharacterFromDoc, getLocationFromDoc, getPropFromDoc, LOCATION_FIELDS, PROP_FIELDS } from '@/features/text-editor/utils/entity'
import { TextSkeleton } from '@/features/text-editor'
  
// Placeholder config for TipTap
const CHARACTER_PLACEHOLDER_BY_NODE = CHARACTER_FIELDS.reduce<Record<string, string>>(
    (acc, field) => {
      acc[field.nodeType] = field.placeholder
      return acc
    },
    {}
  )
  
const LOCATION_PLACEHOLDER_BY_NODE = LOCATION_FIELDS.reduce<Record<string, string>>(
    (acc, field) => {
      acc[field.nodeType] = field.placeholder
      return acc
    },
    {}
  )
  
const PROP_PLACEHOLDER_BY_NODE = PROP_FIELDS.reduce<Record<string, string>>(
    (acc, field) => {
      acc[field.nodeType] = field.placeholder
      return acc
    },
    {}
)

const ROLE_COLORS: Record<CharacterEntity['metadata']['role'], { bg: string; text: string }> = {
    protagonist: { bg: 'bg-green-500/20', text: 'text-green-600' },
    antagonist: { bg: 'bg-red-500/20', text: 'text-red-400' },
    supporting: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    minor: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
}

export const CharacterCreationDefault: CharacterEntity['metadata'] = {
    name: '',
    role: 'protagonist' as const,
    age: 18,
    occupation: '',
    physicalDescription: '',
    personalityTraits: [],
    backstory: '',
    motivation: '',
    flaw: '',
    voice: ''
}
  
  // Character Detail View Component
export function CharacterDetailView({
    data,
    onChange,
    isCreation,
  }: {
    data: CharacterEntity | undefined
    onChange: (data: CharacterEntity['metadata']) => void
    isCreation: boolean
  }) {

    const character = data || {
        id: 'new',
        type: 'CHARACTER',
        name: '',
        slug: '',
        metadata: CharacterCreationDefault,
    }

    const defaultState = isCreation ? CharacterCreationDefault : character.metadata
    const [state, setState] = useState<CharacterEntity['metadata']>(defaultState)

    const entityId = character.id

    const handleFieldChange = (field: keyof CharacterEntity['metadata'], value: string | number) => {
        const newState = {
            ...state,
            [field]: value
        }
        setState(newState)
        onChange(newState)
    }

    const doc = buildCharacterDoc(character.metadata)

    const handleDocChange = (doc: JSONContent) => {
        const fields = getCharacterFromDoc(doc)
        const newState = {
            ...state,
            ...fields
        }
        setState(newState)
        onChange(newState)
    }

    const editor = useGetEntityEditor('character', handleDocChange)

    useEffect(()=>{
        if (editor && entityId) {
            editor.commands.setContent(doc, {emitUpdate: false})
            setState(character.metadata)
        }
    }, [editor, entityId])

    if (!editor) {
        return <EntityLoadingView />
    }

    return (
      <div className="">
        {/* Header Section */}
        <div className="flex border-b gap-4 mb-8 pb-6">
          <div className="size-20 rounded-full bg-background grid place-content-center font-semibold text-3xl shrink-0">
            {state.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center mb-4">
              <input
                type="text"
                value={state.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="flex-1 min-w-0 bg-transparent border-none p-0 text-[2rem] font-bold text-black outline-none"
                placeholder="Character name..."
              />
              <span className={cn('uppercase py-1 px-2 text-sm font-medium', ROLE_COLORS[state.role].bg, ROLE_COLORS[state.role].text)}>
                {state.role.toUpperCase()}
              </span>
            </div>
            <div className="flex gap-4 ">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-green-600 uppercase tracking-wider">ROLE</span>
                <select
                  value={state.role}
                  onChange={(e) => handleFieldChange('role', e.target.value)}
                  className="bg-transparent border-none p-0 pr-2 text-black outline-none"
                >
                  <option value="protagonist">Protagonist</option>
                  <option value="antagonist">Antagonist</option>
                  <option value="supporting">Supporting</option>
                  <option value="minor">Minor</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-green-600 uppercase tracking-wider">AGE</span>
                <input
                  type="number"
                  value={state.age}
                  onChange={(e) => handleFieldChange('age', parseInt(e.target.value) || 0)}
                  className="text-black w-15"
                  min={1}
                  max={100}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-sm text-green-600 uppercase tracking-wider">OCCUPATION</span>
                <textarea
                //   type="text"
                  value={state.occupation}
                  onChange={(e) => handleFieldChange('occupation', e.target.value)}
                  className="text-black w-full resize-none"
                  placeholder="Enter occupation..."
                />
              </div>
            </div>
          </div>
        </div>
  
        {/* TipTap Editor for content fields */}
        <div className="entity-editor">
            <EditorContent editor={editor} />
        </div>
      </div>
    )
  }
  
  // Location Detail View Component
export function LocationDetailView({
    data,
    onChange,
    isCreation,
  }: {
    data: LocationEntity | undefined
    onChange: (data: LocationEntity['metadata']) => void
    isCreation: boolean
  }) {

    const location = data || {
        id: 'new',
        type: 'LOCATION',
        name: '',
        slug: '',
        metadata: {
            name: '',
            description: ''
        }
    }

    const defaultState = isCreation ? {
        name: '',
        description: ''
    } : location.metadata

    const [state, setState] = useState<LocationEntity['metadata']>(defaultState)
    const entityId = location.id

    const handleFieldChange = (field: keyof LocationEntity['metadata'], value: string) => {
        const newState = {
            ...state,
            [field]: value
        }
        setState(newState)
        onChange(newState)
    }

    const doc = buildLocationDoc(location.metadata)

    const handleDocChange = (doc: JSONContent) => {
        const { description } = getLocationFromDoc(doc)
        const newState = {
            ...state,
            description
        }
        setState(newState)
        onChange(newState)
    }

    const editor = useGetEntityEditor('location', handleDocChange)

    useEffect(()=>{
        if (editor && entityId) {
            editor.commands.setContent(doc, {emitUpdate: false})
            setState(location.metadata)
        }
    }, [editor, entityId])

    if (!editor) {
        return <EntityLoadingView />
    }

    return (
      <div className="">
        {/* Header Section */}
        <div className="mb-8 flex gap-4 border-b">
          <div className="grid size-20 shrink-0 place-content-center rounded-full bg-background text-3xl font-semibold">
            <IconMapPin className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="mb-4 flex items-start">
              <textarea
                value={state.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="flex-1 min-w-0 border-none p-0 text-[2rem] font-bold text-black outline-none resize-none"
                placeholder="Location name..."
              />
              <span className="bg-amber-500/20 px-2 py-1 text-sm font-medium uppercase text-amber-400">
                LOCATION
              </span>
            </div>
          </div>
        </div>
  
        {/* TipTap Editor for description */}
        <div className="entity-editor">
            <EditorContent editor={editor} />
        </div>
      </div>
    )
  }
  
  // Prop Detail View Component
export function PropDetailView({
    data,
    onChange,
    isCreation,
  }: {
    data: PropEntity | undefined
    onChange: (data: PropEntity['metadata']) => void
    isCreation: boolean
  }) {

    const prop = data || {
        id: 'new',
        type: 'PROP',
        name: '',
        slug: '',
        metadata: {
            name: '',
            description: ''
        }
    }

    const defaultState = isCreation ? {
        name: '',
        description: ''
    } : prop.metadata

    const [state, setState] = useState<PropEntity['metadata']>(defaultState)
    const entityId = prop.id

    const handleFieldChange = (field: keyof PropEntity['metadata'], value: string) => {
        const newState = {
            ...state,
            [field]: value
        }
        setState(newState)
        onChange(newState)
    }

    const doc = buildPropDoc(prop.metadata)

    const handleDocChange = (doc: JSONContent) => {
        const { description } = getPropFromDoc(doc)
        const newState = {
            ...state,
            description
        }
        setState(newState)
        onChange(newState)
    }

    const editor = useGetEntityEditor('prop', handleDocChange)

    useEffect(()=>{
        if (editor && entityId) {
            editor.commands.setContent(doc, {emitUpdate: false})
            setState(prop.metadata)
        }
    }, [editor, entityId])

    if (!editor) {
        return <EntityLoadingView />
    }

    return (
      <div className="">
        {/* Header Section */}
        <div className="mb-8 flex gap-4 border-b">
          <div className="grid size-20 shrink-0 place-content-center rounded-full bg-background text-3xl font-semibold">
            <IconBox className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="mb-4 flex items-center">
              <textarea
                value={state.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="flex-1 min-w-0 bg-transparent border-none p-0 text-[2rem] font-bold text-black outline-none resize-none"
                placeholder="Prop name..."
              />
              <span className="bg-purple-500/20 px-2 py-1 text-sm font-medium uppercase text-purple-400">
                PROP
              </span>
            </div>
          </div>
        </div>
  
        {/* TipTap Editor for description */}
        <div className="entity-editor">
            <EditorContent editor={editor} />
        </div>
      </div>
    )
}


function useGetEntityEditor(type: 'character' | 'location' | 'prop', onChange: (doc: JSONContent) => void){

    const mapping = useRef({
        character: {
            extensions: CharacterFieldNodes,
            placeholderByNodeType: CHARACTER_PLACEHOLDER_BY_NODE,
        },
        location: {
            extensions: LocationFieldNodes,
            placeholderByNodeType: LOCATION_PLACEHOLDER_BY_NODE,
        },
        prop: {
            extensions: PropFieldNodes,
            placeholderByNodeType: PROP_PLACEHOLDER_BY_NODE,
        },
    })
    const currentEditor: RefObject<Editor | null> = useRef(null)

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
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
                trailingNode: false,
            }),
            Placeholder.configure({
                placeholder: ({ node }) => mapping.current[type].placeholderByNodeType[node.type.name] ?? '',
                includeChildren: true,
            }),
            ...mapping.current[type].extensions
        ],
        // content: initialDoc,
        editorProps: {
          attributes: {
            class: 'entity-editor-content',
          },
        },
        onUpdate: ({ editor: currentEditor }) => {
          const doc = currentEditor.getJSON()
          onChange(doc)
        },
      })

    currentEditor.current = editor

    return currentEditor.current
}

export function EntityLoadingView(){
    return (
      <div className='container mx-auto max-w-paper mt-18 p-paper-pad bg-white'>
        <div className='flex items-start gap-4 mb-4'>
          <div className='size-20 rounded-full bg-slate-500/20 animate-pulse'/>
          <div className='flex-1 space-y-6'>
            <div className='flex items-center gap-2'>
              <div className='h-6 w-50 rounded-full bg-slate-500/20 animate-pulse'/>
              <div className='h-6 w-25 rounded-full bg-slate-500/20 animate-pulse ml-auto'/>
            </div>
            <div className='flex items-start gap-4 space-y-2'>
              <div className='h-4 w-30 rounded-full bg-slate-500/20 animate-pulse'/>
              <div className='h-4 w-20 rounded-full bg-slate-500/20 animate-pulse'/>
              <div className='h-4 w-35 rounded-full bg-slate-500/20 animate-pulse'/>
            </div>
  
          </div>
        </div>
        <div className='w-full h-px bg-slate-500/40 my-4'/>
        <div className='space-y-4'>
          <TextSkeleton />
          <TextSkeleton />
          <TextSkeleton />
        </div>
  
      </div>
    )
  }
