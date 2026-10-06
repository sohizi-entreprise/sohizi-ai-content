import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import {
  captureAnalyticsPageview,
  disableAnalytics,
  enableAnalytics,
} from "./browser"
import type { ReactNode } from "react"
import type { PostHogPublicConfig } from "./browser"

export type ConsentChoice = "accepted" | "rejected" | null

type ConsentContextValue = {
  choice: ConsentChoice
  ready: boolean
  openSettings: () => void
  trackPageview: (url: string) => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useAnalyticsConsent(): ConsentContextValue {
  const value = useContext(ConsentContext)
  if (!value) throw new Error("AnalyticsProvider is missing")
  return value
}

export function AnalyticsProvider({
  children,
  config,
  consentEndpoint,
  privacyHref,
  app,
}: {
  children: ReactNode
  config: PostHogPublicConfig
  consentEndpoint: string
  privacyHref: string
  app: "site" | "web"
}) {
  const [choice, setChoice] = useState<ConsentChoice>(null)
  const [ready, setReady] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const applyChoice = useCallback(
    (next: ConsentChoice) => {
      if (next === "accepted") {
        if (!enableAnalytics(config)) {
          disableAnalytics()
          setChoice(null)
          setError(
            "Analytics is unavailable right now. Please try again later.",
          )
          return
        }
      } else {
        disableAnalytics()
      }
      setChoice(next)
      setError("")
    },
    [config.project, config.apiHost, config.apiVersion],
  )

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(consentEndpoint, { credentials: "include" })
      if (!response.ok) throw new Error("Consent could not be loaded")
      const data = (await response.json()) as { choice: ConsentChoice }
      applyChoice(data.choice)
      if (data.choice !== null) setSettingsOpen(false)
    } catch {
      applyChoice(null)
    } finally {
      setReady(true)
    }
  }, [consentEndpoint, applyChoice])

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [refresh])

  const choose = async (next: Exclude<ConsentChoice, null>) => {
    setSaving(true)
    setError("")
    try {
      const response = await fetch(consentEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: next }),
      })
      if (!response.ok) throw new Error("Unable to save your choice")
      const data = (await response.json()) as { choice: ConsentChoice }
      applyChoice(data.choice)
      setSettingsOpen(false)
    } catch {
      setError("Your choice could not be saved. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const trackPageview = useCallback(
    (url: string) => {
      if (choice === "accepted") captureAnalyticsPageview(url, app)
    },
    [choice, app],
  )

  return (
    <ConsentContext.Provider
      value={{
        choice,
        ready,
        openSettings: () => setSettingsOpen(true),
        trackPageview,
      }}
    >
      {children}
      {ready && (choice === null || settingsOpen) && (
        <aside
          aria-label="Cookie preferences"
          style={{
            position: "fixed",
            zIndex: 1000,
            left: 16,
            right: 16,
            bottom: 16,
            margin: "0 auto",
            maxWidth: 560,
            padding: 20,
            borderRadius: 16,
            border: "1px solid #64748b",
            background: "#111827",
            color: "#f9fafb",
            boxShadow: "0 16px 48px rgba(0,0,0,.35)",
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>
            Analytics cookies
          </strong>
          <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
            We use PostHog to understand which parts of Sohizi Lab help people
            create videos. Analytics is optional. Your choice applies to this
            website and the app, and you can change it at any time. See our{" "}
            <a href={privacyHref} style={{ textDecoration: "underline" }}>
              privacy policy
            </a>
            .
          </p>
          {error && (
            <p role="alert" style={{ color: "#fca5a5", marginBottom: 10 }}>
              {error}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => void choose("accepted")}
              style={buttonStyle}
            >
              Accept analytics
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void choose("rejected")}
              style={buttonStyle}
            >
              Reject analytics
            </button>
            {choice !== null && (
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                style={{ padding: "8px 10px", color: "inherit" }}
              >
                Close
              </button>
            )}
          </div>
        </aside>
      )}
    </ConsentContext.Provider>
  )
}

const buttonStyle = {
  flex: "1 1 150px",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  color: "#111827",
  fontWeight: 600,
  cursor: "pointer",
} as const

export function CookieSettingsButton({ className }: { className?: string }) {
  const { openSettings } = useAnalyticsConsent()
  return (
    <button type="button" className={className} onClick={openSettings}>
      Cookie settings
    </button>
  )
}
