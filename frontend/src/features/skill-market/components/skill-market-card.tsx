import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { MarketSkill } from '../types'

type SkillMarketCardProps = {
  skill: MarketSkill
}

export function SkillMarketCard({ skill }: SkillMarketCardProps) {
  return (
    <Card className="glass-panel flex h-full cursor-pointer flex-col gap-4 rounded-2xl transition-all duration-400 hover:border-primary/30! group">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="truncate text-lg font-bold text-white transition-all duration-300 group-hover:text-primary">
              {skill.name}
            </CardTitle>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Skill
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-6">
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {skill.description || 'No description provided.'}
        </p>
        {skill.categories.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skill.categories.slice(0, 3).map((category) => (
              <Badge key={category.id} variant="secondary" className="text-[10px]">
                {category.name}
              </Badge>
            ))}
            {skill.categories.length > 3 ? (
              <Badge variant="outline" className="text-[10px]">
                +{skill.categories.length - 3}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <p className="text-xs font-medium uppercase text-muted-foreground">
          View details
        </p>
      </CardFooter>
    </Card>
  )
}
