import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import appCss from "../styles.css?url"

import type { QueryClient } from "@tanstack/react-query"
import { Toaster } from "@sohizi/ui/sonner"
import { loadPublicEnv } from "@/lib/load-public-env"
import { getPublicEnv, setPublicEnv, type PublicEnv } from "@/lib/public-env"

interface MyRouterContext {
  queryClient: QueryClient
  publicEnv?: PublicEnv
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
        title: "Sohizi Lab — AI Video Workspace",
      },
      {
        name: "description",
        content:
          "Write scripts, generate media, storyboard, and edit video in one AI-assisted workspace.",
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
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const { publicEnv } = Route.useRouteContext()
  if (publicEnv) {
    setPublicEnv(publicEnv)
  }

  return (
    <>
      <Outlet />
      <Toaster position="bottom-right" />
    </>
  )
}
