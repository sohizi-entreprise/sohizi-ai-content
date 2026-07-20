import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CanvasWrapperProps {
  aspectRatio: number
  children: ReactNode
  className?: string
}

export function CanvasWrapper({ aspectRatio, children, className }: CanvasWrapperProps) {
  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden',
        className,
      )}
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    >
      <div
        className="relative max-h-full max-w-full"
        style={{
          aspectRatio,
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      >
        <div
          className="absolute inset-0 m-auto"
          style={{
            aspectRatio,
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
          }}
        >
          <div
            className="relative h-full w-full overflow-hidden shadow-lg ring-1 ring-white/10"
            style={{ backgroundColor: 'black' }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
