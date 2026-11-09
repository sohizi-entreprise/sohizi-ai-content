import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"
import { Search, X } from "lucide-react"
import { Button } from "@sohizi/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@sohizi/ui/empty"
import { Skeleton } from "@sohizi/ui/skeleton"
import {
  listMarketCategoriesQueryOptions,
  listMarketSkillsQueryOptions,
} from "../query-mutation"
import { SkillMarketCard } from "./skill-market-card"
import { SkillMarketDetailSheet } from "./skill-market-detail-sheet"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { cn } from "@/lib/utils"

export function SkillMarketListPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId",
  })
  const [search, setSearch] = useState("")
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debouncedSearch = useDebouncedValue(search.trim(), 250)

  const { data: categories = [] } = useQuery(listMarketCategoriesQueryOptions())
  const {
    data: skills = [],
    isLoading,
    isError,
    refetch,
  } = useQuery(
    listMarketSkillsQueryOptions(
      debouncedSearch || undefined,
      selectedCategoryId ?? undefined,
    ),
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable

      if (
        (event.key === "/" && !isEditable) ||
        ((event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "k" &&
          !isEditable)
      ) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const hasActiveFilters =
    Boolean(debouncedSearch) || selectedCategoryId !== null
  const activeCategoryName =
    categories.find((cat) => cat.id === selectedCategoryId)?.name ?? null

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-t-2xl border border-white/[0.06] bg-card/30">
      {/* Ambient architectural studio backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-36 left-1/3 h-96 w-160 -translate-x-1/2 rounded-full bg-primary/[0.05] blur-[130px]" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-chart-2/[0.04] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage:
              "radial-gradient(ellipse 80% 55% at 50% 0%, black 15%, transparent 85%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 55% at 50% 0%, black 15%, transparent 85%)",
          }}
        />
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex w-full max-w-7xl flex-col px-6 pt-8 pb-14 sm:px-10 sm:pt-12">
          {/* Editorial Hero Header */}
          <header className="flex flex-col gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl lg:text-[42px] lg:leading-[1.08]">
              Skill Marketplace
              <span className="mt-1 block font-normal text-muted-foreground/60 sm:inline sm:mt-0 sm:ml-3">
                Curated studio intelligence.
              </span>
            </h1>

            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground/80 sm:text-sm">
              Equip your project workspace with specialized domain craft,
              autonomous workflows, and reusable production instructions.
            </p>
          </header>

          {/* Sticky Minimalist Command & Filter Bar */}
          <div className="sticky top-0 z-20 -mx-6 mb-8 border-b border-white/[0.05] bg-background/60 px-6 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/45 sm:-mx-10 sm:px-10">
            <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
              {/* Minimalist Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                <CategoryFilterPill
                  label="All"
                  active={selectedCategoryId === null}
                  onClick={() => setSelectedCategoryId(null)}
                />
                {categories.map((category) => (
                  <CategoryFilterPill
                    key={category.id}
                    label={category.name}
                    active={selectedCategoryId === category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                  />
                ))}
              </div>

              {/* Glass Command Search Input */}
              <div className="relative w-full md:w-80 lg:w-96 shrink-0">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      if (search) {
                        setSearch("")
                      } else {
                        searchInputRef.current?.blur()
                      }
                    }
                  }}
                  placeholder="Search skills..."
                  aria-label="Search skills by name"
                  className="h-9 w-full rounded-full border border-white/[0.08] bg-white/[0.03] pr-12 pl-9 text-xs text-foreground placeholder:text-muted-foreground/60 backdrop-blur-md transition-all duration-300 focus:border-primary/40 focus:bg-white/[0.05] focus:shadow-[0_0_28px_-8px_color-mix(in_oklch,var(--primary)_35%,transparent)] focus:outline-none"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("")
                      searchInputRef.current?.focus()
                    }}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2.5 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/50">
                    /
                  </kbd>
                )}
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2.5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    Showing{" "}
                    <strong className="font-medium text-foreground">
                      {skills.length}
                    </strong>{" "}
                    {skills.length === 1 ? "result" : "results"}
                  </span>
                  {activeCategoryName ? (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>
                        in{" "}
                        <span className="text-foreground/90">
                          {activeCategoryName}
                        </span>
                      </span>
                    </>
                  ) : null}
                  {debouncedSearch ? (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>
                        matching{" "}
                        <span className="font-mono text-foreground/90">
                          “{debouncedSearch}”
                        </span>
                      </span>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("")
                    setSelectedCategoryId(null)
                  }}
                  className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary"
                >
                  Reset
                </button>
              </div>
            ) : null}
          </div>

          {/* Skills Grid */}
          {isLoading ? (
            <SkillMarketListSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-12 text-center backdrop-blur-md">
              <p className="text-sm text-destructive">Failed to load skills</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            </div>
          ) : skills.length === 0 ? (
            <Empty className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-20 backdrop-blur-sm">
              <EmptyHeader>
                <EmptyTitle className="font-display text-lg tracking-tight">
                  No skills found
                </EmptyTitle>
                <EmptyDescription className="max-w-xs text-xs leading-relaxed">
                  {hasActiveFilters
                    ? "No capabilities match your current filter criteria. Try adjusting your search or category."
                    : "Public skills will appear here once they are published."}
                </EmptyDescription>
                {hasActiveFilters ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-full border-white/10 bg-white/[0.03] text-xs"
                    onClick={() => {
                      setSearch("")
                      setSelectedCategoryId(null)
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
              {skills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className="block h-full w-full appearance-none rounded-2xl border-0 bg-transparent p-0 text-left focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                  onClick={() => setSelectedSkillId(skill.id)}
                >
                  <SkillMarketCard skill={skill} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <SkillMarketDetailSheet
        projectId={projectId}
        skillId={selectedSkillId}
        open={selectedSkillId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSkillId(null)
        }}
      />
    </div>
  )
}

function CategoryFilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide transition-all duration-200",
        active
          ? "border-primary/40 bg-primary/12 text-primary shadow-[0_0_20px_-6px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
          : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:bg-white/[0.05] hover:text-foreground",
      )}
    >
      {active ? (
        <span className="size-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
      ) : null}
      <span>{label}</span>
    </button>
  )
}

function SkillMarketListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex min-h-[210px] flex-col justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="size-1.5 rounded-full" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-6 w-2/3 rounded-md" />
              <Skeleton className="h-3.5 w-full rounded-md" />
              <Skeleton className="h-3.5 w-5/6 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-4">
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
