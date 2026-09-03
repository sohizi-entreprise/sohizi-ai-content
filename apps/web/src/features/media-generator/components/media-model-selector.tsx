import { useMemo, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import type { CatalogModel } from "@/features/admin/types"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector"
import { Skeleton } from "@sohizi/ui/skeleton"

type MediaModelSelectorProps = {
  models: Array<CatalogModel>
  selectedModelId: string | null
  onSelect: (modelId: string) => void
  isLoading: boolean
}

export function MediaModelSelector({
  models,
  selectedModelId,
  onSelect,
  isLoading,
}: MediaModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const selectedModel = models.find((model) => model.id === selectedModelId)

  const grouped = useMemo(() => {
    const map = new Map<string, Array<CatalogModel>>()
    for (const model of models) {
      const list = map.get(model.provider) ?? []
      list.push(model)
      map.set(model.provider, list)
    }
    return map
  }, [models])

  if (isLoading) {
    return <Skeleton className="h-11 w-full rounded-xl" />
  }

  return (
    <ModelSelector
      open={open}
      onOpenChange={setOpen}
    >
      <ModelSelectorTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-full items-center gap-2 rounded-xl border bg-background px-3 text-sm transition-colors hover:bg-accent/40"
        >
          {selectedModel ? (
            <>
              <ModelSelectorLogo
                provider={selectedModel.provider}
                className="size-4"
              />
              <span className="min-w-0 flex-1 truncate text-left">
                {selectedModel.name}
              </span>
            </>
          ) : (
            <span className="flex-1 text-left text-muted-foreground">
              Select model
            </span>
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </ModelSelectorTrigger>
      <ModelSelectorContent title="Select model">
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {[...grouped.entries()].map(([provider, providerModels]) => (
            <ModelSelectorGroup
              key={provider}
              heading={provider}
            >
              {providerModels.map((model) => (
                <ModelSelectorItem
                  key={model.id}
                  value={model.name}
                  onSelect={() => {
                    onSelect(model.id)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <ModelSelectorLogo
                    provider={model.provider}
                    className="size-4"
                  />
                  <ModelSelectorName>{model.name}</ModelSelectorName>
                  {model.id === selectedModelId ? (
                    <Check className="ml-auto size-4 shrink-0 text-primary" />
                  ) : null}
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  )
}
