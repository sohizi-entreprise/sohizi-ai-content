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

export default function RenderCanvas() {
  return (
    <div className="h-full">
      <ScriptEditor 
        content={EXAMPLE_CONTENT}
        onChange={(content) => console.log('Content changed:', content)}
      />
    </div>
  )
}
