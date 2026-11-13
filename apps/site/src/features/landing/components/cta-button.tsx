import { captureAnalyticsEvent } from "@sohizi/analytics/browser"
import { Button } from "@sohizi/ui/button"
import { CTA_LABEL } from "../content"
import { useLaunchGate } from "./launch-gate"
import { cn } from "@/lib/utils"
import { appUrl } from "@/lib/app-url"

type CtaButtonProps = {
  className?: string
  size?: "default" | "lg" | "sm"
  label?: string
  location?: string
}

export function CtaButton({
  className,
  size = "lg",
  label = CTA_LABEL,
  location = "unknown",
}: CtaButtonProps) {
  const { enabled, openWaitlist } = useLaunchGate()
  return (
    <Button
      asChild
      size={size}
      className={cn(
        "h-11 rounded-lg px-6 text-base font-semibold shadow-primary",
        className,
      )}
    >
      {enabled ? (
        <a
          href={appUrl("/sign-up")}
          onClick={() =>
            captureAnalyticsEvent("marketing_cta_clicked", {
              location,
              destination: "sign-up",
            })
          }
        >
          {label}
        </a>
      ) : (
        <button type="button" onClick={openWaitlist}>
          {label}
        </button>
      )}
    </Button>
  )
}
