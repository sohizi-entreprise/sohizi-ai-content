import type { MarketSkill } from "../types"

type SkillMarketCardProps = {
  skill: MarketSkill
}

export function SkillMarketCard({ skill }: SkillMarketCardProps) {
  const primaryCategory = skill.categories[0]?.name
  const extraCategories = skill.categories.slice(1, 3)
  const remainingCount = Math.max(0, skill.categories.length - 3)

  return (
    <article className="group relative flex h-full min-h-[210px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-md transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white/[0.04] hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7),0_0_32px_-12px_color-mix(in_oklch,var(--primary)_22%,transparent)]">
      {/* Top specular hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent transition-all duration-500 group-hover:inset-x-4 group-hover:via-primary/70"
      />

      {/* Ambient hover bloom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-0 size-48 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative z-10 space-y-4">
        {/* Minimalist architectural eyebrow */}
        {primaryCategory ? (
          <div className="flex items-center min-w-0">
            <span className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/75 transition-colors duration-300 group-hover:text-foreground/90">
              {primaryCategory}
            </span>
          </div>
        ) : null}

        {/* Title & description */}
        <div className="space-y-2.5">
          <h3 className="line-clamp-1 font-display text-[19px] font-semibold tracking-[-0.02em] text-foreground transition-colors duration-300 group-hover:text-primary">
            {skill.name}
          </h3>
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground/85 transition-colors duration-300 group-hover:text-foreground/80">
            {skill.description || "No description provided."}
          </p>
        </div>
      </div>

      {/* Extra category pills when present */}
      {extraCategories.length > 0 ? (
        <div className="relative z-10 mt-6 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-4 transition-colors duration-300 group-hover:border-white/10">
          {extraCategories.map((category) => (
            <span
              key={category.id}
              className="truncate rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground transition-colors duration-300 group-hover:border-white/12 group-hover:text-foreground/80"
            >
              {category.name}
            </span>
          ))}
          {remainingCount > 0 ? (
            <span className="rounded-full border border-white/[0.07] px-2 py-0.5 font-mono text-[10px] text-muted-foreground/60">
              +{remainingCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
