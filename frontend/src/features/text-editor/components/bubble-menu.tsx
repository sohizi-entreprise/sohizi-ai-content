import { Editor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'

export default function ActionsBubbleMenu({ editor }: { editor: Editor }) {
    const { isBold, isItalic, isStrikethrough } = useEditorState({
        editor,
        selector: ctx => ({
          isBold: ctx.editor.isActive('bold'),
          isItalic: ctx.editor.isActive('italic'),
          isStrikethrough: ctx.editor.isActive('strike'),
        }),
    })
      
  return (
    <BubbleMenu editor={editor} options={{ placement: 'bottom', offset: 8, flip: true }}>
        <div className="flex items-center gap-5 bg-white px-4 py-2 drop-shadow-lg rounded-md border border-gray-100">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={isBold ? 'is-active' : ''}
                type="button"
            >
                Bold
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
