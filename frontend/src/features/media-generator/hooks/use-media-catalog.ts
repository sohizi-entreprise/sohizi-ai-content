import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  listCatalogModelOptionsQueryOptions,
  listCatalogModelsQueryOptions,
} from '@/features/admin/query-mutation'
import type { ComposerMediaType } from '../types'

const MEDIA_TYPE_CATEGORIES: Record<ComposerMediaType, string[]> = {
  image: ['text-to-image', 'image-to-image'],
  video: ['text-to-video', 'video-to-video'],
  audio: ['text-to-speech'],
}

export function useMediaCatalog(mediaType: ComposerMediaType) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)

  const categories = MEDIA_TYPE_CATEGORIES[mediaType]
  const modelsQuery = useQuery(listCatalogModelsQueryOptions(categories))
  const optionsQuery = useQuery(listCatalogModelOptionsQueryOptions(selectedModelId))

  useEffect(() => {
    setSelectedModelId(null)
  }, [mediaType])

  useEffect(() => {
    if (modelsQuery.isLoading) return

    const models = modelsQuery.data
    if (!models || models.length === 0) return

    const stillValid = selectedModelId && models.some((model) => model.id === selectedModelId)
    if (!stillValid) {
      setSelectedModelId(models[0].id)
    }
  }, [
    modelsQuery.data,
    modelsQuery.isLoading,
    selectedModelId,
  ])

  return {
    models: modelsQuery.data ?? [],
    options: optionsQuery.data ?? [],
    selectedModelId,
    setSelectedModelId,
    isLoadingModels: modelsQuery.isLoading,
    isLoadingOptions: optionsQuery.isLoading,
  }
}
