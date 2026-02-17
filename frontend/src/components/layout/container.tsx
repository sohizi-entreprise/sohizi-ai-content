import { cn } from '@/lib/utils'
import { ClassValue } from 'clsx'
import React from 'react'

export default function Container({ children, className }: { children: React.ReactNode, className?: ClassValue }) {
  return (
    <div className={cn('container mx-auto max-w-6xl', className)}>
        {children}
    </div>
  )
}
