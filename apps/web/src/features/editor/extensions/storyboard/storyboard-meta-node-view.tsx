import { NodeViewWrapper } from "@tiptap/react"

export function StoryboardMetaNodeView() {
  return (
    <NodeViewWrapper
      className="storyboard-meta"
      as="div"
      hidden
      contentEditable={false}
    />
  )
}
