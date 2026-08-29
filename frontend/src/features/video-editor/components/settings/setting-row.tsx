import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingRowProps {
  label: string
  children: ReactNode
  className?: string
  align?: 'center' | 'start'
}

export function SettingRow({
  label,
  children,
  className,
  align = 'center',
}: SettingRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[96px_1fr] gap-3',
        align === 'center' ? 'items-center' : 'items-start',
        className,
      )}
    >
      <div className="text-sm text-foreground">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

interface SettingSectionProps {
  title?: string
  children: ReactNode
  className?: string
}

export function SettingSection({
  title,
  children,
  className,
}: SettingSectionProps) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      {title ? (
        <h3 className="px-0.5 text-sm font-medium text-muted-foreground">
          {title}
        </h3>
      ) : null}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
        {children}
      </div>
    </section>
  )
}
