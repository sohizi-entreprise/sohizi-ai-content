import { cn } from '@/lib/utils'
import type { TokenUsage } from '../types'

type ContextWindowDonutProps = {
  usage: {percentage: number}
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const sizeConfig = {
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
  const strokeDashoffset = circumference - (usage.percentage / 100) * circumference

  // Color based on usage
  const getStrokeColor = () => {
    if (usage.percentage >= 90) return 'stroke-red-500/50'
    if (usage.percentage >= 70) return 'stroke-yellow-500/50'
    return 'stroke-primary/50'
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

// Helper to calculate token usage from content
export function calculateTokenUsage(
  content: string,
  contextItems: { content: string }[],
  maxTokens: number = 128000
): TokenUsage {
  // Rough estimation: ~4 characters per token
  const contentTokens = Math.ceil(content.length / 4)
  const contextTokens = contextItems.reduce(
    (acc, item) => acc + Math.ceil(item.content.length / 4),
    0
  )
  const used = contentTokens + contextTokens
  const percentage = Math.min((used / maxTokens) * 100, 100)

  return { used, total: maxTokens, percentage }
}
