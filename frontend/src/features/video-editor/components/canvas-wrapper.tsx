import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CanvasWrapperProps {
  aspectRatio: number
  children: ReactNode
  className?: string
}

export function CanvasWrapper({
  aspectRatio,
  children,
  className,
}: CanvasWrapperProps) {
  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden aspect-video bg-black',
        className,
      )}
      // style={{
      //   backgroundImage:
      //     'linear-gradient(var(--border) 1px, transparent 1px),' +
      //     'linear-gradient(90deg, var(--border) 1px, transparent 1px)',
      //   backgroundSize: '20px 20px',
      // }}
    >
      <div
        className="relative h-full max-h-full w-full max-w-full"
        style={{ aspectRatio }}
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
          <div className="relative h-full w-full overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
