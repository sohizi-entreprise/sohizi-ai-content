import NewProjectInput from "../components/new-project-input"

export default function StartProject() {
  return (
    <section
      className="mx-auto max-w-4xl space-y-8"
      aria-labelledby="start-project-title"
    >
      <div className="space-y-4 text-center">
        <p className="mx-auto w-fit rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Sohizi Lab
        </p>
        <h1
          id="start-project-title"
          className="text-4xl font-semibold leading-16 text-white tracking-tight sm:text-5xl lg:text-6xl"
        >
          Turn your idea into
          <span className="block text-primary drop-shadow-[0_0_25px_color-mix(in_oklch,var(--primary)_45%,transparent)]">
            a video story
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-foreground sm:text-base">
          Describe your vision and shape it into a video project, or start with
          a blank canvas.
        </p>
      </div>
      <NewProjectInput />
    </section>
  )
}
