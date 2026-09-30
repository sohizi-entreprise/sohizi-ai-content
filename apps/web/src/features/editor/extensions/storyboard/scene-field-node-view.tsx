import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"

const FIELD_LABELS: Record<string, string> = {
  sceneEnvironment: "Environment",
  sceneLighting: "Lighting",
}

export function SceneFieldNodeView({ node }: ReactNodeViewProps) {
  const label = FIELD_LABELS[node.type.name] ?? ""

  return (
    <NodeViewWrapper
      className="storyboard-scene-field"
      as="div"
      data-field={node.type.name}
    >
      <span className="storyboard-scene-field-label" contentEditable={false}>
        {label}
      </span>
      <NodeViewContent className="storyboard-scene-field-value" as="div" />
    </NodeViewWrapper>
  )
}
