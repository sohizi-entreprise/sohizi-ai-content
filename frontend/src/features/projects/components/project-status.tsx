
type Props = {
    status: string
}

export default function ProjectStatus({status}: Props) {
  const {text, bg, label} = GetColorMap(status)
  return (
    <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${bg} animate-pulse`}></span>
        <span className={`text-[10px] font-bold ${text} uppercase tracking-widest`}>{label}</span>
    </div>
  )
}

function GetColorMap(status: string){
  switch (true) {
    case status.startsWith('CONCEPT_'):
      return {text: 'text-blue-400', bg: 'bg-blue-500', label: 'Concept'}
    case status.startsWith('OUTLINE_'):
      return {text: 'text-green-400', bg: 'bg-green-500', label: 'Outline'}
    case status.startsWith('SYNOPSIS_'):
      return {text: 'text-yellow-400', bg: 'bg-yellow-500', label: 'Drafting'}
    default:
      return {text: 'text-purple-400', bg: 'bg-purple-500', label: 'Scripting'}
  }
}
