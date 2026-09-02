import { createFileRoute } from "@tanstack/react-router"
import { LegalPage } from "@/features/landing/pages/legal-page"
import { privacyPolicy } from "@/features/landing/content/legal"

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      {
        title: "Privacy Policy — Sohizi Lab",
      },
      {
        name: "description",
        content:
          "How Sohizi Lab collects, uses, and shares information when you use our AI video workspace.",
      },
    ],
  }),
  component: PrivacyRoute,
})

function PrivacyRoute() {
  return <LegalPage document={privacyPolicy} />
}
