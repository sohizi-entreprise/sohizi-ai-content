import { Editor } from '@tiptap/react'
import { FloatingMenu } from '@tiptap/react/menus'

export const BlockFloatingMenu = ({ editor }: { editor: Editor }) => {

  return (
    <FloatingMenu editor={editor}>
        <div className="floating-menu" data-testid="floating-menu">
        <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
        >
            H1
        </button>
        <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
        >
            H2
        </button>
        <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'is-active' : ''}
        >
            Bullet list
        </button>
        </div>
    </FloatingMenu>
  )
}