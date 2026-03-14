import { Extension } from "@tiptap/core";


export const SelectionShortcut = Extension.create({
    name: 'selectionShortcut',
  
    addKeyboardShortcuts() {
      return {
        'Mod-k': ({ editor }) => {
          const { from, to } = editor.state.selection
          
          // If no selection (cursor is at a single point), do nothing
          if (from === to) {
            return false
          }
          
          // Get the selected text
          const selectedText = editor.state.doc.textBetween(from, to, ' ')
          
          // Get the parent block's blockId
        //   const parentNode = $from.parent
        //   const blockId = parentNode.attrs?.blockId as string | undefined
          
          // Generate a unique block ID for this selection
          const blockId = crypto.randomUUID()
          
          // Apply the context anchor mark to wrap the selection
          editor.chain().setContextAnchor({ blockId }).run()
          
          // Create display text (truncated if needed)
          const displayText = selectedText.length > 24 
            ? selectedText.slice(0, 24) + '...' 
            : selectedText
          
          editor.storage.editorEventBus?.bus?.emit("contextSelected", {
            id: blockId,
            display: displayText,
            from,
            to,
          })
          
          return true
        },
      };
    },
  });