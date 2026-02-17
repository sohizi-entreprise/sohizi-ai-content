import { useScriptStore } from "../store"
import { useShallow } from "zustand/shallow"
import { IconListDetails } from "@tabler/icons-react"



export function OutlineTab() {

    const plan = useScriptStore(useShallow((state) => state.scriptPlan))
    // const isStreaming = useScriptStore(useShallow((state) => state.isStreaming))
  
    if (plan === null) {
      return (
        <EmptyState
          icon={<IconListDetails className="size-8 text-zinc-600" />}
          title="No outline yet"
          description="Generate an outline to see your story structure here."
        />
      )
    }
    
    const structure = plan?.structure || []
    const segments = structure.filter((b) => b.type === 'segment')
    const title = plan?.title
    const logline = plan?.logline
  
    const getChildBlocks = (parentId: string) =>
        structure.filter((b) => b.parentId === parentId)
  
    return (
      <div className="space-y-4">
        {/* Title & Logline */}
        {(title || logline) && (
          <div className="p-3 rounded-lg bg-zinc-800/40 border border-white/5">
            {title && (
              <h3 className="font-semibold text-zinc-100">{title}</h3>
            )}
            {logline && (
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                {logline}
              </p>
            )}
          </div>
        )}
  
        {/* Segments */}
        {segments.map((segment, index) => {
          const children = getChildBlocks(segment.id)
          const summary = children.find((c) => c.type === 'segmentSummary')
          const scenes = children.filter((c) => c.type === 'scene')
  
          return (
            <div
              key={segment.id}
              className="p-3 rounded-lg bg-zinc-800/40 border border-white/5 hover:border-emerald-500/20 transition-colors"
            >
              <div className="flex items-start gap-2 mb-2">
                <div className="flex items-center justify-center size-6 min-w-6 rounded-md bg-emerald-600/20 text-emerald-400 text-xs font-bold">
                  {index + 1}
                </div>
                <h3 className="font-medium text-zinc-200 mb-2">{segment.content}</h3>
              </div>
                {summary && (
                <p className="text-sm text-zinc-400 leading-relaxed">
                    {summary.content}
                </p>
                )}
  
              {/* Scenes in this segment */}
              {scenes.length > 0 && (
                <div className="mt-3 space-y-2">
                  {scenes.map((scene, sceneIndex) => (
                    <div
                      key={scene.id}
                      className="p-2 rounded-md bg-zinc-900/50 border border-white/5 hover:border-amber-500/20 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center size-5 px-2 rounded bg-amber-500/10 text-amber-400 text-[10px] font-medium">
                          {sceneIndex + 1}
                        </span>
                        <span className="text-sm text-zinc-300 line-clamp-2">
                          {scene.content}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }


function EmptyState({
    icon,
    title,
    description,
  }: {
    icon: React.ReactNode
    title: string
    description: string
  }) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 p-3 rounded-full bg-zinc-800/50">{icon}</div>
        <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        <p className="mt-1 text-xs text-zinc-500 max-w-[200px]">{description}</p>
      </div>
    )
  }