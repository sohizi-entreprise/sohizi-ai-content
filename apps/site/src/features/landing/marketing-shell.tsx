import { LandingNav } from "./sections/nav"
import { LandingFooter } from "./sections/footer"
import { ShaderBackground } from "./components/shader-background"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type MarketingShellProps = {
  children: ReactNode
  /** Landing hero sits under the fixed nav; other pages should pass top padding. */
  mainClassName?: string
  ambient?: boolean
}

export function MarketingShell({
  children,
  mainClassName,
  ambient = false,
}: MarketingShellProps) {
  return (
    <div
      className={cn(
        "min-h-svh bg-background text-foreground",
        ambient && "landing-ambient-shell",
      )}
    >
      {ambient && (
        <div className="landing-ambient-background" aria-hidden="true">
          <ShaderBackground className="landing-shader-canvas" />
        </div>
      )}
      <div className="fixed inset-x-0 top-0 z-50">
        <LandingNav />
      </div>
      <main className={cn(ambient && "landing-glass-main", mainClassName)}>
        {children}
      </main>
      <LandingFooter />
    </div>
  )
}
