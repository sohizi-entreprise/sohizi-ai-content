import {RefObject, useRef} from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { CharacterFieldNodes, LocationFieldNodes, PropFieldNodes } from '@/features/text-editor/extensions'
import type { Editor, JSONContent } from '@tiptap/react'
import '@/features/text-editor/styles/editor.css'
import { CharacterEntity} from '@/features/projects/type'
import { buildCharacterDoc, buildLocationDoc, buildPropDoc, CHARACTER_FIELDS, LOCATION_FIELDS, PROP_FIELDS } from '@/features/text-editor/utils/entity'
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
    data: JSONContent | undefined
    onChange: (data: JSONContent) => void
    isCreation: boolean
  }) {

    const doc = isCreation ? buildCharacterDoc(CharacterCreationDefault) : data

    const handleDocChange = (data: JSONContent) => {
        onChange(data)
    }

    const editor = useGetEntityEditor('character', doc, handleDocChange)

    if (!editor) {
        return <EntityLoadingView />
    }

    return (
      <div className="entity-editor">
        <EditorContent editor={editor} />
      </div>
    )
  }
  
// Location Detail View Component
export function LocationDetailView({
    data,
    onChange,
    isCreation,
  }: {
    data: JSONContent | undefined
    onChange: (data: JSONContent) => void
    isCreation: boolean
  }) {

    const createData = {
        name: '',
        description: ''
    }

    const doc = isCreation ? buildLocationDoc(createData) : data

    const editor = useGetEntityEditor('location', doc, onChange)

    if (!editor) {
        return <EntityLoadingView />
    }

    return (
      <div className="entity-editor">
        <EditorContent editor={editor} />
      </div>
  
    )
}
  
  // Prop Detail View Component
export function PropDetailView({
    data,
    onChange,
    isCreation,
  }: {
    data: JSONContent | undefined
    onChange: (data: JSONContent) => void
    isCreation: boolean
  }) {

    const createState = {
        name: '',
        description: ''
    }

    const doc = isCreation? buildPropDoc(createState) : data

    const editor = useGetEntityEditor('prop', doc, onChange)


    if (!editor) {
        return <EntityLoadingView />
    }

    return (
      <div className="entity-editor">
        <EditorContent editor={editor} />
      </div>
    )
}


function useGetEntityEditor(type: 'character' | 'location' | 'prop', content: JSONContent | undefined, onChange: (doc: JSONContent) => void){

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
        content: content,
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
