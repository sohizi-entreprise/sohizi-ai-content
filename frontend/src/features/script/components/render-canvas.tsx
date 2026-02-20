import { useState } from 'react'
import { ScriptEditor, type JSONContent } from '@/features/text-editor'

// Example script content in JSON format
const EXAMPLE_CONTENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'sceneHeading',
      content: [{ type: 'text', text: 'INT. COFFEE SHOP - DAY' }]
    },
    {
      type: 'action',
      content: [{ type: 'text', text: 'A busy coffee shop. Customers line up at the counter. SARAH (30s) sits alone at a table, staring at her laptop.' }]
    },
    {
      type: 'character',
      content: [{ type: 'text', text: 'SARAH' }]
    },
    {
      type: 'parenthetical',
      content: [{ type: 'text', text: 'muttering to herself' }]
    },
    {
      type: 'dialogue',
      content: [{ type: 'text', text: "Why won't this code work..." }]
    },
  ]
}

interface RenderCanvasProps {
  /** Initial content for the editor */
  initialContent?: JSONContent
}

export default function RenderCanvas({ 
  initialContent = EXAMPLE_CONTENT 
}: RenderCanvasProps) {
  const [content, setContent] = useState<JSONContent>(initialContent)

  return (
    <div className="h-full">
      <ScriptEditor 
        content={content}
        onChange={(newContent) => {
          setContent(newContent)
          console.log('Content changed:', newContent)
        }}
      />
    </div>
  )
}
