import { getProjectQueryOptions } from "@/features/projects/query-mutation"
import { cn } from "@/lib/utils"
import { IconFileText } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"


export function BriefTab({ projectId }: {projectId: string}) {
    const { data: project, isLoading } = useQuery(getProjectQueryOptions(projectId))

    if (isLoading) {
      return <LoadingSkeleton />
    }
  
    if (!project) {
      return (
        <EmptyState
          icon={<IconFileText className="size-8 text-zinc-600" />}
          title="No brief available"
          description="The project brief will appear here once created."
        />
      )
    }
  
    return (
      <div className="space-y-5">
        {/* Project Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <h3 className="text-sm font-semibold text-zinc-200">Project</h3>
          </div>
          <p className="text-zinc-200 font-medium text-lg">{project.name}</p>
          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs capitalize">
            {project.format}
          </span>
        </div>
  
        {/* Initial User Input */}
        {project.initialInput && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-amber-500" />
              <h3 className="text-sm font-semibold text-zinc-200">
                Initial Input
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs capitalize">
                {project.initialInput.type}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {project.initialInput.content}
              </p>
            </div>
          </div>
        )}
  
        {/* Project Details */}
        <div className="grid grid-cols-3 gap-3">
          <InfoCard label="Audience" value={project.audience} color="purple" />
          <InfoCard label="Tone" value={project.tone || 'N/A'} color="pink" />
          <InfoCard label="Genre" value={project.genre || 'N/A'} color="cyan" />
        </div>
  
        {/* Constraints */}
        {project.constraints && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-rose-500" />
              <h3 className="text-sm font-semibold text-zinc-200">
                Constraints
              </h3>
            </div>
  
            {project.constraints.mustInclude?.length > 0 && (
              <ConstraintList
                label="Must Include"
                items={project.constraints.mustInclude}
                color="emerald"
              />
            )}
  
            {project.constraints.mustAvoid?.length > 0 && (
              <ConstraintList
                label="Must Avoid"
                items={project.constraints.mustAvoid}
                color="rose"
              />
            )}
  
            {project.constraints.forbiddenPhrases?.length > 0 && (
              <ConstraintList
                label="Forbidden Phrases"
                items={project.constraints.forbiddenPhrases}
                color="orange"
              />
            )}
          </div>
        )}
      </div>
    )
  }


  function LoadingSkeleton() {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg bg-zinc-800/40 animate-pulse"
          />
        ))}
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
  
  function InfoCard({
    label,
    value,
    color,
  }: {
    label: string
    value: string
    color: 'purple' | 'pink' | 'cyan'
  }) {
    const colorClasses = {
      purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
      cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    }
  
    return (
      <div className={cn('p-2 rounded-lg border', colorClasses[color])}>
        <span className="block text-[10px] uppercase tracking-wide opacity-70">
          {label}
        </span>
        <span className="text-sm font-medium capitalize">{value}</span>
      </div>
    )
  }
  
  function ConstraintList({
    label,
    items,
    color,
  }: {
    label: string
    items: string[]
    color: 'emerald' | 'rose' | 'orange'
  }) {
    const colorClasses = {
      emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    }
  
    return (
      <div className="space-y-1.5">
        <span className="text-xs text-zinc-500">{label}</span>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={i}
              className={cn(
                'px-2 py-0.5 rounded-md text-xs border',
                colorClasses[color]
              )}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    )
  }