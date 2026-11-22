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
import { listMarketSkillsQueryOptions } from "../query-mutation"
import { SkillMarketCard } from "./skill-market-card"
import { SkillMarketDetailSheet } from "./skill-market-detail-sheet"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

export function SkillMarketListPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId",
  })
  const [search, setSearch] = useState("")
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debouncedSearch = useDebouncedValue(search.trim(), 250)

  const {
    data: skills = [],
    isLoading,
    isError,
    refetch,
  } = useQuery(listMarketSkillsQueryOptions(debouncedSearch || undefined))

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

  const hasActiveSearch = Boolean(debouncedSearch)

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card">
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex w-full max-w-7xl flex-col px-6 pt-8 pb-14 sm:px-10 sm:pt-12">
          {/* Header & Search Bar */}
          <header className="mb-8 flex flex-col gap-6 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl lg:text-[42px] lg:leading-[1.08]">
                Skill Marketplace
              </h1>
              <p className="max-w-lg text-xs leading-relaxed text-muted-foreground/80 sm:text-sm">
                Equip your project workspace with specialized domain craft,
                autonomous workflows, and reusable production instructions.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full shrink-0 lg:w-80 xl:w-96">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
                className="h-10 w-full rounded-xl border border-border bg-white/5 pr-12 pl-9 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors duration-200 focus:border-white/20 focus:bg-background/80 focus:outline-none"
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
          </header>

          {hasActiveSearch ? (
            <div className="mb-6 flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  Showing{" "}
                  <strong className="font-medium text-foreground">
                    {skills.length}
                  </strong>{" "}
                  {skills.length === 1 ? "result" : "results"}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span>
                  matching{" "}
                  <span className="font-mono text-foreground/90">
                    “{debouncedSearch}”
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear
              </button>
            </div>
          ) : null}

          {/* Skills Grid */}
          {isLoading ? (
            <SkillMarketListSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-12 text-center">
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
            <Empty className="rounded-2xl border border-dashed border-white/10 bg-background/30 py-20">
              <EmptyHeader>
                <EmptyTitle className="font-display text-lg tracking-tight">
                  No skills found
                </EmptyTitle>
                <EmptyDescription className="max-w-xs text-xs leading-relaxed">
                  {hasActiveSearch
                    ? "No capabilities match your search. Try a different keyword."
                    : "Public skills will appear here once they are published."}
                </EmptyDescription>
                {hasActiveSearch ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-full border-white/10 bg-white/[0.03] text-xs"
                    onClick={() => setSearch("")}
                  >
                    Clear search
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
                  className="block h-full w-full appearance-none rounded-2xl border-0 bg-transparent p-0 text-left focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
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
