import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router"
import { useEffect } from "react"
import {
  AnalyticsProvider,
  useAnalyticsConsent,
} from "@sohizi/analytics/consent"
import appCss from "../styles.css?url"
import type { PublicEnv } from "@/lib/public-env"
import { loadPublicEnv } from "@/lib/load-public-env"
import { getPublicEnv, setPublicEnv } from "@/lib/public-env"

interface RouterContext {
  publicEnv?: PublicEnv
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    let publicEnv: PublicEnv
    try {
      publicEnv = getPublicEnv()
    } catch {
      publicEnv = await loadPublicEnv()
      setPublicEnv(publicEnv)
    }
    return { publicEnv }
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Sohizi Lab — Stop Prompting. Start Directing.",
      },
      {
        name: "description",
        content:
          "Write the script, lock your characters, storyboard every scene, generate video and sound, and edit the final cut in one AI studio that remembers your story.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Geist:wght@100..900&display=swap",
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-geist antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__SOHIZI_SENTRY__=${JSON.stringify(Route.useRouteContext().publicEnv.sentry).replace(/</g, "\\u003c")};`,
          }}
        />
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const { publicEnv } = Route.useRouteContext()
  setPublicEnv(publicEnv)

  return (
    <AnalyticsProvider
      config={{
        project: publicEnv.posthogProject,
        apiHost: publicEnv.posthogApiHost,
        apiVersion: publicEnv.posthogApiVersion,
      }}
      consentEndpoint="/api/analytics/consent"
      privacyHref="/privacy"
      app="site"
    >
      <AnalyticsRouteTracker />
      <Outlet />
    </AnalyticsProvider>
  )
}

function AnalyticsRouteTracker() {
  const href = useRouterState({ select: (state) => state.location.href })
  const { choice, trackPageview } = useAnalyticsConsent()
  useEffect(() => {
    if (choice === "accepted")
      trackPageview(new URL(href, window.location.origin).href)
  }, [choice, href, trackPageview])
  return null
}
