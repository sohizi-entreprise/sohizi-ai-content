import { createFileRoute } from "@tanstack/react-router"
import { LandingPage } from "@/features/landing/landing-page"

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Sohizi Lab — Stop Prompting. Start Directing.",
      },
      {
        name: "description",
        content:
          "Write the script, lock your characters, storyboard every scene, generate video and sound, and edit the final cut in one AI studio that remembers your story.",
      },
    ],
  }),
  component: LandingPage,
})
