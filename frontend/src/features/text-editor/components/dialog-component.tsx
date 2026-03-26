import { NodeViewWrapper, NodeViewContent, ReactNodeViewProps } from "@tiptap/react"


const DialogueComponent = (_props: ReactNodeViewProps) =>{


    return (
        <NodeViewWrapper className="border-l-2 border-orange-500 pl-2 mb-4">
            <NodeViewContent />
        </NodeViewWrapper>
    )
}

export default DialogueComponent