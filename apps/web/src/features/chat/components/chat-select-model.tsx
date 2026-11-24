import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Check, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Spinner } from "@sohizi/ui/spinner"
import { setChatReasoningEffort, useChatStore } from "../store/chat-store"
import {
  listAgentRunsInfiniteQueryOptions,
  listModelsQueryOptions,
} from "../query-mutation"
import {
  reasoningEffortLabel,
  resolveReasoningEffort,
} from "../lib/reasoning-effort"
import {
  latestRunModelId,
  readSelectedModelId,
  resolveChatModel,
  writeSelectedModelId,
} from "../lib/selected-model"
import { ReasoningEffortSelect } from "./reasoning-effort-select"
import type { LlmModel } from "../types"
import { getProjectModelPreferencesQueryOptions } from "@/features/projects/query-mutation"
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
  const conversationId = useChatStore((state) => state.activeConversation?.id)
  const isNew = useChatStore((state) => state.activeConversation?.isNew ?? true)
  const reasoningEffortByModelId = useChatStore(
    (state) => state.reasoningEffortByModelId,
  )
  const { data: models = [], isLoading } = useQuery(
    listModelsQueryOptions(projectId, ["leading-agent"]),
  )
  const { data: modelPreferences, isLoading: preferencesLoading } = useQuery(
    getProjectModelPreferencesQueryOptions(projectId),
  )
  const preferredLeadingAgent = useMemo(
    () =>
      modelPreferences?.find((item) => item.key === "leading-agent") ?? null,
    [modelPreferences],
  )
  const preferredModelId = preferredLeadingAgent?.modelId ?? null
  const preferredReasoningEffort =
    preferredLeadingAgent?.parameters.reasoning_effort != null
      ? String(preferredLeadingAgent.parameters.reasoning_effort)
      : null
  const lastPreferredModelIdRef = useRef<string | null>(null)
  const lastPreferredReasoningKeyRef = useRef<string | null>(null)
  const { select: _flattenRuns, ...runQueryOptions } =
    listAgentRunsInfiniteQueryOptions(projectId, conversationId ?? "", isNew)
  const {
    data: firstPageRuns = [],
    isSuccess: runsLoaded,
    isPlaceholderData: runsArePlaceholder,
  } = useInfiniteQuery({
    ...runQueryOptions,
    enabled: Boolean(conversationId) && !isNew,
    select: (data) => data.pages[0]?.data ?? [],
  })

  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!preferredModelId || !preferredReasoningEffort) return
    const key = `${preferredModelId}:${preferredReasoningEffort}`
    if (lastPreferredReasoningKeyRef.current === key) return
    lastPreferredReasoningKeyRef.current = key
    setChatReasoningEffort(preferredModelId, preferredReasoningEffort)
  }, [preferredModelId, preferredReasoningEffort])

  useEffect(() => {
    if (models.length === 0) return
    const storedModelId = readSelectedModelId()
    if (
      model &&
      preferredModelId &&
      preferredModelId !== lastPreferredModelIdRef.current &&
      isNew &&
      !storedModelId
    ) {
      lastPreferredModelIdRef.current = preferredModelId
      const updatedPreferred = models.find(
        (item) => item.id === preferredModelId,
      )
      if (updatedPreferred && updatedPreferred.id !== model.id) {
        setModel(updatedPreferred)
        return
      }
    }
    if (model) {
      const refreshed = models.find((item) => item.id === model.id)
      if (refreshed && refreshed !== model) setModel(refreshed)
      return
    }
    if (!conversationId) return
    if (!isNew && (!runsLoaded || runsArePlaceholder)) return
    if (!storedModelId && preferencesLoading) return

    lastPreferredModelIdRef.current = preferredModelId
    const next = resolveChatModel(models, {
      runModelId: isNew ? null : latestRunModelId(firstPageRuns),
      storedModelId,
      preferredModelId,
    })
    if (next) setModel(next)
  }, [
    conversationId,
    firstPageRuns,
    isNew,
    model,
    models,
    preferencesLoading,
    preferredModelId,
    runsArePlaceholder,
    runsLoaded,
    setModel,
  ])

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
    writeSelectedModelId(mod.id)
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
