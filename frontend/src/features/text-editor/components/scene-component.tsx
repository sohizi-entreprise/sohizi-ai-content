import { cn } from "@/lib/utils";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { NodeViewWrapper, ReactNodeViewProps, NodeViewContent } from "@tiptap/react";
import { MouseEvent, useState } from "react";

const SceneComponent = (props: ReactNodeViewProps) =>{
    const [collapsed, setCollapsed] = useState(false)

    const {node: {attrs}} = props

    const sceneNumber = attrs.sceneNumber

    const toggleCollapse = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setCollapsed(!collapsed)
    }

    return (
        <NodeViewWrapper className={cn("flex gap-6")}>
            <div className="self-start flex items-start gap-1">
                <button onClick={toggleCollapse} className="size-4 cursor-pointer text-muted-foreground">
                    {collapsed ? <IconChevronDown className="size-4" /> : <IconChevronUp className="size-4" />}
                </button>
                <span className="text-base font-bold">
                    {sceneNumber}
                </span>
            </div>

            <div className={cn("flex-1 transition-all duration-300", collapsed && "scene-collapsed-content h-6 overflow-hidden")}>
                <NodeViewContent />
            </div>
        </NodeViewWrapper>
    )
}

export default SceneComponent