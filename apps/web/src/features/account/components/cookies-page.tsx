import { useAnalyticsConsent } from "@sohizi/analytics/consent"
import { Button } from "@sohizi/ui/button"
import { Card, CardContent } from "@sohizi/ui/card"
import { Spinner } from "@sohizi/ui/spinner"
import { Check } from "lucide-react"
import { IconChartBubbleFilled, IconLockFilled } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { getPublicEnv } from "@/lib/public-env"

const options = [
  {
    value: "accepted",
    icon: IconChartBubbleFilled,
    title: "Accept analytics cookies",
    description:
      "Help us improve Sohizi by sharing anonymous product usage and performance data.",
  },
  {
    value: "rejected",
    icon: IconLockFilled,
    title: "Reject analytics cookies",
    description:
      "Only strictly necessary cookies required to run the app will be used.",
  },
] as const

export function AccountCookiesPage() {
  const { choice, ready, saving, error, choose } = useAnalyticsConsent()
  const privacyHref = `${getPublicEnv().siteUrl.replace(/\/$/, "")}/privacy`

  return (
    <Card className="border-none bg-white/5!">
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <h3 className="font-semibold tracking-tight">Cookie preferences</h3>
          <p className="text-sm text-muted-foreground">
            Choose how we use cookies on Sohizi. You can change this at any
            time.
          </p>
        </div>

        {!ready ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Spinner />
            Loading your preferences...
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option) => {
              const selected = choice === option.value
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  aria-pressed={selected}
                  onClick={() => void choose(option.value)}
                  className={cn(
                    "group relative flex cursor-pointer flex-col gap-3 rounded-xl p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "border border-white/10 bg-white/5"
                      : "bg-card/80 hover:bg-card",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full transition-colors text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4.5" />
                    </div>
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-foreground",
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{option.title}</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saving ? (
            <>
              <Spinner />
              Saving your choice...
            </>
          ) : choice ? (
            <>
              <Check className="size-3.5 text-primary" />
              Your preference is saved.
            </>
          ) : (
            "No preference saved yet."
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Read our{" "}
          <Button variant="link" asChild className="h-auto p-0 text-xs">
            <a href={privacyHref} target="_blank" rel="noreferrer">
              privacy policy
            </a>
          </Button>{" "}
          to learn more.
        </p>
      </CardContent>
    </Card>
  )
}
