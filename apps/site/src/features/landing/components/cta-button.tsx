import { CTA_LABEL } from "../content"
import { Button } from "@sohizi/ui/button"
import { cn } from "@/lib/utils"
import { appUrl } from "@/lib/app-url"

type CtaButtonProps = {
  className?: string
  size?: "default" | "lg" | "sm"
  label?: string
}

export function CtaButton({
  className,
  size = "lg",
  label = CTA_LABEL,
}: CtaButtonProps) {
  return (
    <Button
      asChild
      size={size}
      className={cn(
        "h-11 rounded-lg px-6 text-base font-medium shadow-[var(--shadow-primary)]",
        className,
      )}
    >
      <a href={appUrl("/sign-up")}>{label}</a>
    </Button>
  )
}
