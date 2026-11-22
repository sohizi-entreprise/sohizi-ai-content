import { IconPlus } from "@tabler/icons-react"
import { Button } from "@sohizi/ui/button"
import CreateProject from "../components/create-project"
import NewProjectInput from "../components/new-project-input"
import StepMarker from "../components/step-marker"

export default function StartProject() {
  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-label="Create project"
    >
      <StepMarker
        step="New Project"
        title="Turn your idea into a video story"
        description="Start with a project brief and production settings to guide your workspace, or jump straight into a blank canvas."
      />

      <NewProjectInput />

      <div className="flex items-center gap-4 px-2">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
          or
        </span>
        <div className="h-px flex-1 bg-white/8" />
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-white">
            Start from scratch
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Open an empty workspace and build your brief, scripts, and
            storyboards step by step.
          </p>
        </div>

        <CreateProject
          trigger={
            <Button
              variant="outline"
              className="w-full shrink-0 rounded-full border-white/15 bg-white/5 px-4 font-semibold text-white hover:bg-white/10 sm:w-auto cursor-pointer"
            >
              <IconPlus className="size-4" />
              Start from scratch
            </Button>
          }
        />
      </div>
    </section>
  )
}
