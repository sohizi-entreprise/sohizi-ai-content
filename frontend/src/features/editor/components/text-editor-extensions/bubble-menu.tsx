import { Editor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { useEffect, useState } from 'react'
import { useEditorInputBridge } from '../../bridge/use-editor-input-bridge'

type TextEditorBubbleMenuProps = {
    editor: Editor
    file: {
        id: string
        name: string
    }
}

export default function TextEditorBubbleMenu({ editor, file }: TextEditorBubbleMenuProps) {
    const [isSuppressed, setIsSuppressed] = useState(false)
    const { isItalic, isStrikethrough } = useEditorState({
        editor,
        selector: ctx => ({
          isBold: ctx.editor.isActive('bold'),
          isItalic: ctx.editor.isActive('italic'),
          isStrikethrough: ctx.editor.isActive('strike'),
        }),
    })

    const runCommand = useEditorInputBridge(state => state.runCommand)

    useEffect(() => {
        const show = () => setIsSuppressed(false)
        const hide = () => setIsSuppressed(true)

        editor.on('focus', show)
        editor.on('selectionUpdate', show)
        editor.on('blur', hide)

        return () => {
            editor.off('focus', show)
            editor.off('selectionUpdate', show)
            editor.off('blur', hide)
        }
    }, [editor])

    const handleAddContext = () => {
        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to, ' ')

        const textBeforeSelection = editor.state.doc.textBetween(0, from, '\n')
        const startLine = textBeforeSelection.split('\n').length
        const textThroughSelection = editor.state.doc.textBetween(0, to, '\n')
        const endLine = textThroughSelection.split('\n').length

        const lineRange = startLine === endLine ? `L${startLine}` : `L${startLine}-L${endLine}`
        const snippet = selectedText.length > 24 ? selectedText.slice(0, 24) + '...' : selectedText
        const mentionId = `ID: ${file.id} | Snippet: ${snippet}`
        setIsSuppressed(true)
        runCommand({ type: 'insertMention', 
                     mention: { 
                        id: mentionId, 
                        display: `${file.name} | ${lineRange}` 
                    } 
                })
    }

    if (isSuppressed) return null
      
  return (
    <BubbleMenu editor={editor} 
                options={{ placement: 'bottom', offset: 8, flip: true }}
                shouldShow={({ editor }) => {
                    return !isSuppressed && editor.isFocused && !editor.state.selection.empty
                }
                }
    >
        <div className="flex items-center gap-5 bg-gray-700 px-4 py-2 drop-shadow-lg rounded-md text-sm"
             onMouseDown={(event) => event.preventDefault()}
        >
            <button
                onClick={handleAddContext}
                type="button"
            >
                Add as context Cmd+K
            </button>
            <Separator />
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={isItalic ? 'is-active' : ''}
                type="button"
            >
                Italic
            </button>
            <Separator />
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={isStrikethrough ? 'is-active' : ''}
                type="button"
            >
                Strike
            </button>
        </div>
    </BubbleMenu>
  )
}

function Separator (){
    return <div className='h-6 w-px bg-gray-300'/>
}
