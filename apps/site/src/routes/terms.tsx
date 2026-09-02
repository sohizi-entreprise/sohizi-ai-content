import { createFileRoute } from "@tanstack/react-router"
import { LegalPage } from "@/features/landing/pages/legal-page"
import { termsOfService } from "@/features/landing/content/legal"

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      {
        title: "Terms of Service — Sohizi Lab",
      },
      {
        name: "description",
        content:
          "Terms that govern your access to and use of the Sohizi Lab AI video workspace.",
      },
    ],
  }),
  component: TermsRoute,
})

function TermsRoute() {
  return <LegalPage document={termsOfService} />
}
