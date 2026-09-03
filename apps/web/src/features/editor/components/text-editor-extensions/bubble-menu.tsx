import { useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { AtSign } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useEditorInputBridge } from "../../bridge/use-editor-input-bridge"
import TextEditorToolbar from "../content/text-editor-toolbar"
import type { Editor } from "@tiptap/react"
import { Button } from "@sohizi/ui/button"
import { Separator } from "@sohizi/ui/separator"
import { buildAttachedSelection } from "@/features/chat/lib/editor-context"

const BUBBLE_MENU_PLUGIN_KEY = "textEditorBubbleMenu"

type TextEditorBubbleMenuProps = {
  editor: Editor
  scrollContainer: HTMLElement | null
  file: {
    id: string
    name: string
    format: string
  }
}

export default function TextEditorBubbleMenu({
  editor,
  scrollContainer,
  file,
}: TextEditorBubbleMenuProps) {
  const isSuppressedRef = useRef(false)
  const [menuContainer, setMenuContainer] = useState<HTMLElement | null>(null)
  const runCommand = useEditorInputBridge((state) => state.runCommand)

  const { isSelectionEmpty } = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      isSelectionEmpty: currentEditor.state.selection.empty,
    }),
  })

  useEffect(() => {
    // Only clear suppress on focus. selectionUpdate also fires when Add to context
    // collapses the selection, which would immediately re-show the menu.
    const clearSuppress = () => {
      isSuppressedRef.current = false
    }

    editor.on("focus", clearSuppress)

    return () => {
      editor.off("focus", clearSuppress)
    }
  }, [editor])

  const handleAddContext = () => {
    const { from, to } = editor.state.selection
    const selection = buildAttachedSelection({ editor, file, from, to })
    if (!selection) return

    const lines =
      selection.startLine === selection.endLine
        ? `L${selection.startLine}`
        : `L${selection.startLine}-L${selection.endLine}`

    isSuppressedRef.current = true
    runCommand({
      type: "insertMention",
      mention: {
        displayName: file.name,
        fileId: file.id,
        format: file.format,
        lines,
        selection,
      },
    })

    // mousedown on the bubble sets TipTap preventHide, so blur alone won't hide it.
    editor.view.dispatch(
      editor.state.tr.setMeta(BUBBLE_MENU_PLUGIN_KEY, "hide"),
    )
  }

  return (
    <BubbleMenu
      pluginKey={BUBBLE_MENU_PLUGIN_KEY}
      editor={editor}
      resizeDelay={16}
      options={{
        placement: "bottom",
        offset: 8,
        flip: true,
        scrollTarget: scrollContainer ?? window,
      }}
      shouldShow={({ editor: currentEditor, element }) => {
        if (isSuppressedRef.current) return false

        const inTable =
          currentEditor.isActive("tableCell") ||
          currentEditor.isActive("tableHeader")
        const hasSelection = !currentEditor.state.selection.empty || inTable
        if (!hasSelection) return false

        // TipTap hides on blur unless focus stays inside the bubble element.
        // Dropdowns portal into `menuContainer` (inside this element) so focus
        // inside a submenu still counts as "in the menu".
        const menuHasFocus = element.contains(document.activeElement)
        return currentEditor.isFocused || menuHasFocus
      }}
    >
      <div
        ref={setMenuContainer}
        data-editor-bubble-menu
        className="flex max-w-[min(100vw-2rem,42rem)] items-center gap-1 rounded-2xl border bg-card/95 px-1.5 py-1 shadow-lg backdrop-blur-md dark:bg-background"
        onMouseDown={(event) => event.preventDefault()}
      >
        {!isSelectionEmpty && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddContext}
              className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <AtSign className="size-3.5" />
              Add to context
            </Button>
            <Separator
              orientation="vertical"
              className="mx-0.5 h-5!"
            />
          </>
        )}
        <TextEditorToolbar
          editor={editor}
          bare
          portalContainer={menuContainer}
          className="min-w-0 flex-1"
        />
      </div>
    </BubbleMenu>
  )
}
