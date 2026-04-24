import { useState, useEffect } from 'react'
import { AppLayout } from './components/layout/app-layout'

export function VideoProductionEditor() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary/20">
            <span className="text-lg font-bold text-primary">S</span>
          </div>
          <span className="text-sm">Loading editor...</span>
        </div>
      </div>
    )
  }

  return <AppLayout />
}
