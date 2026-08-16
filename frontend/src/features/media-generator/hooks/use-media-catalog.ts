import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listCatalogModelsQueryOptions } from '@/features/admin/query-mutation'
import { getCatalogCategories } from '../constants'
import { useMediaGeneratorStore } from '../store/media-generator-store'

export function useMediaCatalog() {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore((state) => state.generationSubtype)
  const selectedModelId = useMediaGeneratorStore((state) => state.selectedModelId)
  const setSelectedModelId = useMediaGeneratorStore((state) => state.setSelectedModelId)

  const categories = getCatalogCategories(generationType, generationSubtype)
  const hasCatalog = categories.length > 0
  const modelsQuery = useQuery(listCatalogModelsQueryOptions(categories))

  useEffect(() => {
    if (!hasCatalog || modelsQuery.isLoading) return

    const models = modelsQuery.data
    if (!models || models.length === 0) {
      if (selectedModelId) {
        setSelectedModelId(null)
      }
      return
    }

    const stillValid = selectedModelId && models.some((model) => model.id === selectedModelId)
    if (!stillValid) {
      setSelectedModelId(models[0].id)
    }
  }, [
    hasCatalog,
    modelsQuery.data,
    modelsQuery.isLoading,
    selectedModelId,
    setSelectedModelId,
  ])

  return {
    models: modelsQuery.data ?? [],
    selectedModelId,
    setSelectedModelId,
    isLoadingModels: hasCatalog && modelsQuery.isLoading,
    hasCatalog,
  }
}
