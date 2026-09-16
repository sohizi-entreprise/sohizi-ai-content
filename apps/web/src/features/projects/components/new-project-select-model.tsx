import { useQuery } from "@tanstack/react-query"
import { Check, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Spinner } from "@sohizi/ui/spinner"
import { useNewProjectStore } from "../store/new-project-store"
import type { LlmModel } from "@/features/chat/types"
import { listCatalogModelsQueryOptions } from "@/features/chat/query-mutation"
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

export default function NewProjectSelectModel() {
  const modelId = useNewProjectStore((state) => state.modelId)
  const setModelId = useNewProjectStore((state) => state.setModelId)
  const { data: models = [], isLoading } = useQuery(
    listCatalogModelsQueryOptions(["leading-agent"]),
  )

  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => models.find((model) => model.id === modelId) ?? null,
    [models, modelId],
  )

  useEffect(() => {
    if (!modelId && models.length > 0) {
      setModelId(models[0].id)
    }
  }, [modelId, models, setModelId])

  const grouped = useMemo(() => {
    const map = new Map<string, Array<LlmModel>>()
    for (const model of models) {
      const list = map.get(model.provider) ?? []
      list.push(model)
      map.set(model.provider, list)
    }
    return map
  }, [models])

  const onSelect = (model: LlmModel) => {
    setModelId(model.id)
    setOpen(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-2">
        <Spinner className="size-4 animate-spin" />
      </div>
    )
  }

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {selected ? (
            <>
              <ModelSelectorLogo
                provider={selected.provider}
                className="size-3"
              />
              <span className="max-w-30 truncate">{selected.name}</span>
            </>
          ) : (
            "Select Model"
          )}
          <ChevronDown className="size-3 opacity-50" />
        </button>
      </ModelSelectorTrigger>

      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {[...grouped.entries()].map(([provider, providerModels]) => (
            <ModelSelectorGroup key={provider} heading={provider}>
              {providerModels.map((model) => (
                <ModelSelectorItem
                  key={model.id}
                  value={model.name}
                  onSelect={() => onSelect(model)}
                  className="flex items-center gap-2"
                >
                  <ModelSelectorLogo
                    provider={model.provider}
                    className="size-4"
                  />
                  <ModelSelectorName>{model.name}</ModelSelectorName>
                  {model.id === selected?.id && (
                    <Check className="ml-auto size-4 shrink-0 text-primary" />
                  )}
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  )
}
