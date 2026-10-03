import { useQuery } from "@tanstack/react-query"
import { Check, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Spinner } from "@sohizi/ui/spinner"
import { setChatReasoningEffort, useChatStore } from "../store/chat-store"
import { listModelsQueryOptions } from "../query-mutation"
import {
  reasoningEffortLabel,
  resolveReasoningEffort,
} from "../lib/reasoning-effort"
import { ReasoningEffortSelect } from "./reasoning-effort-select"
import type { LlmModel } from "../types"
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
  const reasoningEffortByModelId = useChatStore(
    (state) => state.reasoningEffortByModelId,
  )
  const { data: models = [], isLoading } = useQuery(
    listModelsQueryOptions(projectId, ["leading-agent"]),
  )

  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (models.length === 0) return
    if (!model) {
      setModel(models[0])
      return
    }
    const next = models.find((item) => item.id === model.id)
    if (next && next !== model) {
      setModel(next)
    }
  }, [model, models, setModel])

  const grouped = useMemo(() => {
    const map = new Map<string, Array<LlmModel>>()
    for (const m of models) {
      const list = map.get(m.provider) ?? []
      list.push(m)
      map.set(m.provider, list)
    }
    return map
  }, [models])

  const selectedReasoning = resolveReasoningEffort(
    model,
    reasoningEffortByModelId,
  )
  const selectedReasoningLabel = reasoningEffortLabel(
    model?.reasoningEffort,
    selectedReasoning,
  )

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
              <span className="max-w-30 truncate">{model.name}</span>
              {selectedReasoningLabel ? (
                <span className="text-muted-foreground/80">
                  {selectedReasoningLabel}
                </span>
              ) : null}
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
              {providerModels.map((mod) => {
                const effort = resolveReasoningEffort(
                  mod,
                  reasoningEffortByModelId,
                )
                return (
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
                    <div className="ml-auto flex items-center gap-1">
                      {mod.reasoningEffort ? (
                        <ReasoningEffortSelect
                          reasoningEffort={mod.reasoningEffort}
                          value={effort}
                          onChange={(value) =>
                            setChatReasoningEffort(mod.id, value)
                          }
                        />
                      ) : null}
                      {mod.id === model?.id ? (
                        <Check className="size-4 shrink-0 text-primary" />
                      ) : null}
                    </div>
                  </ModelSelectorItem>
                )
              })}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  )
}
