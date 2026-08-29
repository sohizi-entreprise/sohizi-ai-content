import React from 'react'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

export default function Container({
  children,
  className,
}: {
  children: React.ReactNode
  className?: ClassValue
}) {
  return (
    <div className={cn('container mx-auto max-w-6xl', className)}>
      {children}
    </div>
  )
}
