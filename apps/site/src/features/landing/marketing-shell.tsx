import { LandingNav } from "./sections/nav"
import { LandingFooter } from "./sections/footer"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type MarketingShellProps = {
  children: ReactNode
  /** Landing hero sits under the fixed nav; other pages should pass top padding. */
  mainClassName?: string
}

export function MarketingShell({
  children,
  mainClassName,
}: MarketingShellProps) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="fixed inset-x-0 top-0 z-50">
        <LandingNav />
      </div>
      <main className={cn(mainClassName)}>{children}</main>
      <LandingFooter />
    </div>
  )
}
