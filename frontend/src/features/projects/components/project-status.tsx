import type { ProjectStatusType } from "../type"

type Props = {
    status: ProjectStatusType
}

const COLOR_MAP: Record<ProjectStatusType, {text: string; bg: string}> = {
    'DRAFTING': {text: 'text-blue-400', bg: 'bg-blue-500'},
    'COMPLETED': {text: 'text-green-400', bg: 'bg-green-500'},
    'EDITING': {text: 'text-purple-400', bg: 'bg-purple-500'},
} as const

export default function ProjectStatus({status}: Props) {
  return (
    <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${COLOR_MAP[status].bg} animate-pulse`}></span>
        <span className={`text-[10px] font-bold ${COLOR_MAP[status].text} uppercase tracking-widest`}>{status}</span>
    </div>
  )
}
