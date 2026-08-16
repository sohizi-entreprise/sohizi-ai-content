import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listCatalogModelParametersQueryOptions } from '../query-mutations'
import { useMediaGeneratorStore } from '../store/media-generator-store'

export function useModelParameters() {
  const selectedModelId = useMediaGeneratorStore((state) => state.selectedModelId)
  const setParameterValues = useMediaGeneratorStore((state) => state.setParameterValues)
  const initializedFor = useRef<string | null>(null)

  const parametersQuery = useQuery(listCatalogModelParametersQueryOptions(selectedModelId))

  useEffect(() => {
    if (!selectedModelId) {
      initializedFor.current = null
      return
    }

    if (parametersQuery.isFetching || !parametersQuery.data) return
    if (initializedFor.current === selectedModelId) return

    initializedFor.current = selectedModelId
    setParameterValues(
      Object.fromEntries(
        parametersQuery.data.map((parameter) => [
          parameter.key,
          parameter.defaultValue ?? parameter.options[0]?.value ?? '',
        ]),
      ),
    )
  }, [parametersQuery.data, parametersQuery.isFetching, selectedModelId, setParameterValues])

  return {
    parameters: parametersQuery.data ?? [],
    isLoadingParameters: Boolean(selectedModelId) && parametersQuery.isLoading,
  }
}
