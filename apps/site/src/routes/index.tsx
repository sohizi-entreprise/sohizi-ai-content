import { createFileRoute } from "@tanstack/react-router"
import { LandingPage } from "@/features/landing/landing-page"

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Sohizi Lab — Make the whole AI video in one tool",
      },
      {
        name: "description",
        content:
          "Write scripts, generate media, storyboard, and edit video in one AI-assisted workspace that knows the full context of your project.",
      },
    ],
  }),
  component: LandingPage,
})
