import { useQuery } from "@tanstack/react-query"
import { Check, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useChatStore } from "../store/chat-store"
import { listModelsQueryOptions } from "../query-mutation"
import type { LlmModel } from "../types"
import { Spinner } from "@sohizi/ui/spinner"
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

export default function ChatSelectModel({ projectId }: { projectId: string }) {
  const model = useChatStore((state) => state.model)
  const setModel = useChatStore((state) => state.setModel)
  const { data: models = [], isLoading } = useQuery(
    listModelsQueryOptions(projectId, ["leading-agent"]),
  )

  const [open, setOpen] = useState(false)

  const isNotSet = model === null
  const isEmpty = models.length === 0

  useEffect(() => {
    if (isNotSet && !isEmpty) {
      setModel(models[0])
    }
  }, [isNotSet, isEmpty, setModel])

  const grouped = useMemo(() => {
    const map = new Map<string, Array<LlmModel>>()
    for (const m of models) {
      const list = map.get(m.provider) ?? []
      list.push(m)
      map.set(m.provider, list)
    }
    return map
  }, [models])

  const onSelect = (mod: LlmModel) => {
    setModel(mod)
    setOpen(false)
  }

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
        <button className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          {model ? (
            <>
              <ModelSelectorLogo provider={model.provider} className="size-3" />
              <span className="max-w-[120px] truncate">{model.name}</span>
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
              {providerModels.map((mod) => (
                <ModelSelectorItem
                  key={mod.id}
                  value={mod.name}
                  onSelect={() => onSelect(mod)}
                  className="flex items-center gap-2"
                >
                  <ModelSelectorLogo
                    provider={mod.provider}
                    className="size-4"
                  />
                  <ModelSelectorName>{mod.name}</ModelSelectorName>
                  {mod.id === model?.id && (
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
