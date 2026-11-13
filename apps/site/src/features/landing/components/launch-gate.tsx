import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import { Link } from "@tanstack/react-router"
import type { FormEvent, ReactNode } from "react"
import { appUrl } from "@/lib/app-url"

type LaunchGateState = {
  enabled: boolean | null
  openWaitlist: () => void
}

const LaunchGateContext = createContext<LaunchGateState | null>(null)

export function useLaunchGate(): LaunchGateState {
  const value = useContext(LaunchGateContext)
  if (!value) throw new Error("LaunchGateProvider is missing")
  return value
}

export function LaunchGateProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/feature-flags/ACCEPT_USERS")
      if (!response.ok) throw new Error("Unable to load launch status")
      const result = (await response.json()) as { enable: boolean }
      setEnabled(result.enable === true)
      setLoadError(false)
    } catch {
      setEnabled(null)
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
    if (new URLSearchParams(window.location.search).get("waitlist") === "1") {
      setOpen(true)
    }
  }, [refresh])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      const response = await fetch("/api/waiting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        if (response.status === 409) void refresh()
        throw new Error(result?.error || "Please try again.")
      }
      setSubmitted(true)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <LaunchGateContext.Provider
      value={{ enabled, openWaitlist: () => setOpen(true) }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join the waitlist</DialogTitle>
            <DialogDescription>
              Sohizi Lab will officially launch very soon. Leave your email and
              we’ll email you when it launches.
            </DialogDescription>
          </DialogHeader>
          {enabled === null ? (
            <div className="space-y-3 text-sm" role="status">
              <p>
                {loadError
                  ? "We couldn’t check launch status. Please try again."
                  : "Checking launch status…"}
              </p>
              {loadError && (
                <Button type="button" onClick={() => void refresh()}>
                  Retry
                </Button>
              )}
            </div>
          ) : enabled ? (
            <Button asChild>
              <a href={appUrl("/sign-up")}>Go to sign up</a>
            </Button>
          ) : submitted ? (
            <p role="status" className="text-sm">
              You’re on the waitlist. We’ll email you when Sohizi Lab launches.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="waitlist-email">Email address</Label>
                <Input
                  id="waitlist-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={320}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              {submitError && (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              )}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Joining…" : "Join the waitlist"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Your email will be used for the launch announcement. See our{" "}
                <Link to="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </LaunchGateContext.Provider>
  )
}
