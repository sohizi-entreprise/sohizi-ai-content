import { useSuspenseQuery } from '@tanstack/react-query'
import { getProjectQueryOptions } from '../query-mutation'
import { useConceptStore } from '../store/concept-store'
import { useAutosave } from '@/features/text-editor/hooks/use-autosave'
import { toast } from 'sonner'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import { SynopsisDividerNode, 
    SynopsisTitleNode, 
    SynopsisContentNode, 
    SynopsisSpacerNode, 
    AIAdditionMark, 
    AIDeletionMark, 
    ContextAnchorMark, 
    SelectionShortcut,
    EditorEventBusExtension,
    DiffStoreExtension } from '@/features/text-editor/extensions'
import type { Editor, JSONContent } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { IconArrowBackUp, IconArrowForwardUp, IconArrowNarrowRight, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useEditorAIBridge } from '@/features/chat/hooks/use-ai-editor-bridge'
import { useEffect } from 'react'
import '../../text-editor/styles/synopsis-editor.css'
import { TextSkeleton } from '@/features/text-editor'
import { useChatStore } from '@/features/chat/store/chat-store'
import { respondToChanges } from '@/features/text-editor/extensions/diff-store'

type SynopsisEditorProps = {
    projectId: string
    className?: string
}

export default function SynopsisEditor({projectId, className}: SynopsisEditorProps) {
    const { data } = useSuspenseQuery(getProjectQueryOptions(projectId))
    const isGeneratingSynopsis = useConceptStore(state => state.isGenerating.synopsis)
    const setEditorBridge = useChatStore(state => state.setEditorBridge)
    const resetChatStore = useChatStore(state => state.reset)

    const autosave = useAutosave({
        duration: 1000,
        projectId,
        onSaveComplete: () => {
            console.log('Autosaved synopsis')
        },
        onSaveError: (error) => {
            toast.error('Error autosaving synopsis', {
                position: 'top-center',
            })
            console.error('Error autosaving synopsis', error)
        },
    })

    const handleChange = (content: JSONContent) => {
        autosave({ type: 'synopsis', content })
    }
    const initialContent = undefined

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
          StarterKit.configure({
            // Disable features we don't need
            heading: false,
            blockquote: false,
            codeBlock: false,
            horizontalRule: false,
            bulletList: false,
            orderedList: false,
            listItem: false,
            code: false,
          }),
          Placeholder.configure({
            placeholder: ({ node }) => {
              if (node.type.name === 'synopsisTitle') {
                return 'Title...'
              }
              return ''
            },
          }),
          EditorEventBusExtension,
          DiffStoreExtension,
          SynopsisTitleNode,
          SynopsisDividerNode,
          SynopsisContentNode,
          SynopsisSpacerNode,
          AIAdditionMark,
          AIDeletionMark,
          ContextAnchorMark,
          SelectionShortcut,
        ],
        content: initialContent,
        editable: !isGeneratingSynopsis,
        editorProps: {
          attributes: {
            class: 'synopsis-editor-content',
          },
        },
        onUpdate: ({ editor }) => {
            const json = editor.getJSON()
            handleChange(json)
        }
    })

    const bridge = useEditorAIBridge(editor)

    useEffect(() => {
        if (bridge?.isReady) {
            // Reset the chat store
            resetChatStore()
            // Set the editor bridge
            setEditorBridge(bridge)
        }
    }, [bridge])

    if (!editor) {
        return (
            <div className='main-editor-content space-y-6'>
                <TextSkeleton />
                <TextSkeleton />
                <TextSkeleton />
            </div>
        )
    }

    return (
        <div className={`synopsis-editor ${className}`}>
            <div className="synopsis-editor-wrapper">
                <EditorContent editor={editor} />
            </div>
            <ActionButtons editor={editor} />
        </div>
    )

}

function ActionButtons({ editor }: { editor: Editor }) {
    const canUndo = editor.can().undo()
    const canRedo = editor.can().redo()

    return(
        <div className='flex items-center w-2xl gap-2 absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-xl bg-linear-to-t from-background to-background/80 backdrop-blur-md border border-gray-300/50 drop-shadow-md z-10'>
            <div className='flex items-center'>
                <Button 
                    variant='ghost' 
                    size='icon'
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!canUndo}
                    className='size-9'
                >
                    <IconArrowBackUp className='size-4' />
                </Button>
                <Button 
                    variant='ghost' 
                    size='icon'
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!canRedo}
                    className='size-9'
                >
                    <IconArrowForwardUp className='size-4' />
                </Button>
            </div>

            <div className='h-6 w-px bg-white/20'/>

            <ReviewChanges editor={editor} />
            
            <Button className='font-bold capitalize shadow-md ml-auto'>
                Generate script
                <IconArrowNarrowRight className='size-4' />
            </Button>
        </div>
    )
}

function ReviewChanges({editor}: {editor: Editor}){

    const diffMap = editor.storage.diffStore.diffMap

    const totalChanges = diffMap.size

    if(diffMap.size === 0) return null

    return(
        <>
        <div className='flex items-center'>
            <Button 
                variant='ghost' 
                size='icon'
                onClick={()=>{}}
                className='hover:bg-transparent!'
            >
                <IconChevronLeft className='size-4' />
            </Button>
            <div className='text-sm space-x-1'>
                <span>1</span>
                <span>/</span>
                <span>{totalChanges}</span>
            </div>
            <Button 
                variant='ghost' 
                size='icon'
                onClick={() => {}}
                className='hover:bg-transparent!'
            >
                <IconChevronRight className='size-4' />
            </Button>

            <div className='flex items-center gap-2'>
                <Button 
                    variant='outline' 
                    size='sm'
                    className='border-white/20! hover:bg-primary/5!'
                    onClick={()=>{respondToChanges(editor, 'decline')}}
                >
                    Undo All
                </Button>
                <Button  
                    size='sm'
                    variant='outline'
                    onClick={()=>{respondToChanges(editor, 'accept')}}
                    className='border-primary/50! hover:text-primary! hover:bg-primary/5! text-primary'
                >
                    Keep All
                </Button>
            </div>
        </div>
        <div className='h-6 w-px bg-white/20'/>
        </>
    )
}
