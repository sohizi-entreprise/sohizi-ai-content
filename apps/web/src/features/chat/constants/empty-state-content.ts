import { IconArrowsShuffle, IconBulb, IconRoute } from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"

export type GreetingBuilder = (firstName?: string) => string

export type EmptyStateCommand = {
  id: string
  display: string
}

export type EmptyStateSuggestion = {
  id: string
  icon: Icon
  title: string
  description: string
  promptPrefix: string
  command: EmptyStateCommand
}

export const SUBTITLE =
  "Ask anything about your project, reference files with @, and let the agent help you create."

export const GREETINGS: Array<GreetingBuilder> = [
  (name) =>
    name
      ? `Hey ${name}, what are we making today?`
      : "What are we making today?",
  (name) =>
    name
      ? `Good to see you, ${name}. Ready to create?`
      : "Good to see you. Ready to create?",
  (name) =>
    name
      ? `Canvas is clear, ${name} — where should we start?`
      : "The canvas is clear — where should we start?",
  (name) =>
    name
      ? `Hey ${name}, drop an idea and let's shape it.`
      : "Drop an idea and let's shape it.",
  (name) =>
    name
      ? `Welcome back, ${name}. What's on the studio table?`
      : "Welcome back. What's on the studio table?",
  (name) => (name ? `Ready when you are, ${name}.` : "Ready when you are."),
  (name) =>
    name
      ? `What story are we telling today, ${name}?`
      : "What story are we telling today?",
  (name) =>
    name
      ? `Hi ${name} — let's turn a rough thought into something great.`
      : "Let's turn a rough thought into something great.",
  (name) =>
    name
      ? `Hey ${name}, got a spark we can build on?`
      : "Got a spark we can build on?",
  (name) =>
    name
      ? `Studio's warmed up, ${name}. What's first?`
      : "The studio's warmed up. What's first?",
  (name) =>
    name
      ? `Let's make something worth sharing, ${name}.`
      : "Let's make something worth sharing.",
  (name) =>
    name
      ? `Hey ${name}, point me at a file or pitch me an idea.`
      : "Point me at a file or pitch me an idea.",
]

export const SUGGESTIONS: Array<EmptyStateSuggestion> = [
  {
    id: "brainstorm",
    icon: IconBulb,
    title: "Brainstorm a fresh concept",
    description:
      "Explore angles, hooks, and creative directions from a rough spark.",
    promptPrefix: "Brainstorm a new idea about",
    command: {
      id: "brainstorm",
      display: "Brainstorm",
    },
  },
  {
    id: "remix",
    icon: IconArrowsShuffle,
    title: "Remix existing content",
    description:
      "Reimagine a file, script, or reference into new formats and angles.",
    promptPrefix: "Remix the following content",
    command: {
      id: "remix",
      display: "Remix",
    },
  },
  {
    id: "plan",
    icon: IconRoute,
    title: "Map out a production plan",
    description:
      "Structure the story, beats, and steps before scripting or generating.",
    promptPrefix: "Plan the production for",
    command: {
      id: "plan",
      display: "Plan",
    },
  },
]

export function getFirstName(fullName?: string | null): string | undefined {
  if (!fullName) return undefined
  const trimmed = fullName.trim()
  if (!trimmed) return undefined
  return trimmed.split(/\s+/)[0]
}
