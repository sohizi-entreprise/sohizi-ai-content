import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { buildGenerationPayload } from "../lib/generation-payload"
import { estimateGenerationCreditsQueryOptions } from "../query-mutations"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import type { ModelParameterBinding } from "@/features/admin/types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

export function useGenerationCredits(
  projectId: string,
  parameters: Array<ModelParameterBinding>,
) {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore(
    (state) => state.generationSubtype,
  )
  const selectedModelId = useMediaGeneratorStore(
    (state) => state.selectedModelId,
  )
  const parameterValues = useMediaGeneratorStore(
    (state) => state.parameterValues,
  )

  const payload = useMemo(() => {
    const next = buildGenerationPayload({
      selectedModelId,
      parameterValues,
      parameters,
      generationType,
      generationSubtype,
    })
    const { prompt: _prompt, ...settings } = next.settings
    return { ...next, settings }
  }, [
    generationSubtype,
    generationType,
    parameterValues,
    parameters,
    selectedModelId,
  ])
  const serializedPayload = JSON.stringify(payload)
  const debouncedSerializedPayload = useDebouncedValue(serializedPayload, 250)
  const debouncedPayload = useMemo(
    () => JSON.parse(debouncedSerializedPayload) as typeof payload,
    [debouncedSerializedPayload],
  )

  const estimateQuery = useQuery(
    estimateGenerationCreditsQueryOptions(
      projectId,
      debouncedPayload,
      Boolean(selectedModelId),
    ),
  )

  return {
    credits: estimateQuery.data?.credits ?? null,
    isLoadingCredits: estimateQuery.isFetching,
  }
}
