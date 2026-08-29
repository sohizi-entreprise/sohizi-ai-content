import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import {
  listMarketCategoriesQueryOptions,
  listMarketSkillsQueryOptions,
} from '../query-mutation'
import { SkillMarketCard } from './skill-market-card'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function SkillMarketListPage() {
  const { projectId } = useParams({ from: '/dashboard/projects/$projectId' })
  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )
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

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="space-y-4 px-6 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skill market</h1>
          <p className="text-sm text-muted-foreground">
            Browse public skills and add them to your project.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search skills by name"
            className="pl-9"
          />
        </div>

        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedCategoryId === null ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer',
                selectedCategoryId === null && 'pointer-events-none',
              )}
              onClick={() => setSelectedCategoryId(null)}
            >
              All
            </Badge>
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant={
                  selectedCategoryId === category.id ? 'default' : 'outline'
                }
                className={cn(
                  'cursor-pointer',
                  selectedCategoryId === category.id && 'pointer-events-none',
                )}
                onClick={() => setSelectedCategoryId(category.id)}
              >
                {category.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        {isLoading ? (
          <SkillMarketListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/40 p-8">
            <p className="text-sm text-destructive">Failed to load skills</p>
            <Button variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : skills.length === 0 ? (
          <Empty className="border border-dashed py-16">
            <EmptyHeader>
              <EmptyTitle>No skills found</EmptyTitle>
              <EmptyDescription>
                {debouncedSearch || selectedCategoryId
                  ? 'Try a different search or category filter.'
                  : 'Public skills will appear here once they are published.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => (
              <Link
                key={skill.id}
                to="/dashboard/projects/$projectId/skill-market/$skillId"
                params={{ projectId, skillId: skill.id }}
                className="block"
                preload={false}
              >
                <SkillMarketCard skill={skill} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SkillMarketListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-[220px] w-full rounded-2xl" />
      ))}
    </div>
  )
}
