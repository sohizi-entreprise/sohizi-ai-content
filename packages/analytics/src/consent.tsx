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
  saving: boolean
  error: string
  openSettings: () => void
  choose: (next: Exclude<ConsentChoice, null>) => Promise<void>
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
        saving,
        error,
        openSettings: () => setSettingsOpen(true),
        choose,
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
            // maxWidth: 760,
            padding: 20,
            borderRadius: 16,
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(10px)",
            color: "#f9fafb",
            boxShadow: "0 16px 48px rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <strong style={{ display: "block", marginBottom: 8 }}>
                A better experience starts with cookies
              </strong>
              <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
                We use cookies to optimise your experience on our app. You can
                adjust your choice at any time. See our{" "}
                <a
                  href={privacyHref}
                  style={{
                    textDecoration: "underline",
                    color: "oklch(0.936036 0.225167 121.2409)",
                  }}
                >
                  privacy policy
                </a>
                .
              </p>
              {error && (
                <p role="alert" style={{ color: "#fca5a5", marginBottom: 10 }}>
                  {error}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => void choose("rejected")}
              style={{
                ...buttonStyle,
                background: "black",
                color: "white",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                padding: "0.625rem 1rem",
              }}
            >
              Reject All
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void choose("accepted")}
              style={buttonStyle}
            >
              Accept All
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
  padding: "0.625rem 0.875rem",
  borderRadius: 8,
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
