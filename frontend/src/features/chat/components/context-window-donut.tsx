import { cn } from '@/lib/utils'

type ContextWindowDonutProps = {
  usage: { percentage: number }
  size?: 'sm' | 'md' | 'lg' | 'xs'
  showLabel?: boolean
  className?: string
}

const sizeConfig = {
  xs: { diameter: 14, strokeWidth: 2 },
  sm: { diameter: 20, strokeWidth: 3 },
  md: { diameter: 28, strokeWidth: 4 },
  lg: { diameter: 36, strokeWidth: 5 },
}

export function ContextWindowDonut({
  usage,
  size = 'sm',
  showLabel = false,
  className,
}: ContextWindowDonutProps) {
  const { diameter, strokeWidth } = sizeConfig[size]
  const radius = (diameter - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    circumference - (usage.percentage / 100) * circumference

  // Color based on usage
  const getStrokeColor = () => {
    if (usage.percentage >= 90) return 'stroke-red-500/50'
    if (usage.percentage >= 70) return 'stroke-yellow-500/50'
    return 'stroke-gray-400'
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative" style={{ width: diameter, height: diameter }}>
        <svg
          width={diameter}
          height={diameter}
          viewBox={`0 0 ${diameter} ${diameter}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-white/20"
          />
          {/* Progress circle */}
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn('transition-all duration-300', getStrokeColor())}
          />
        </svg>
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {Math.round(usage.percentage)}%
        </span>
      )}
    </div>
  )
}
