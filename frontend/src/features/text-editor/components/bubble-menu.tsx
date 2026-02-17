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
        <div className="bubble-menu">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={isBold ? 'is-active' : ''}
                type="button"
            >
                Bold
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={isItalic ? 'is-active' : ''}
                type="button"
            >
                Italic
            </button>
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
