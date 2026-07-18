import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  listCatalogModelOptionsQueryOptions,
  listCatalogModelsQueryOptions,
} from '@/features/admin/query-mutation'
import type { CatalogModelOption } from '@/features/admin/types'
import { defaultMediaSettings } from '../constants'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import type { MediaTuning, MediaType } from '../types'

const MEDIA_TYPE_CATEGORIES: Record<MediaType, string[]> = {
  image: ['text-to-image', 'image-to-image'],
  video: ['text-to-video', 'video-to-video'],
  audio: ['text-to-speech'],
}

const toTunings = (options: CatalogModelOption[]): MediaTuning[] =>
  options.map((option) => ({
    key: option.key,
    label: option.label,
    currentValue: option.default ?? option.options[0]?.value,
    options: option.options,
  }))

export function useMediaCatalog(mediaType: MediaType) {
  const selectedModelId = useMediaGeneratorStore((state) => state.selectedModelIds[mediaType])
  const setSelectedModelId = useMediaGeneratorStore((state) => state.setSelectedModelId)
  const replaceSettings = useMediaGeneratorStore((state) => state.replaceSettings)

  const categories = MEDIA_TYPE_CATEGORIES[mediaType]
  const modelsQuery = useQuery(listCatalogModelsQueryOptions(categories))
  const optionsQuery = useQuery(listCatalogModelOptionsQueryOptions(selectedModelId))

  useEffect(() => {
    if (modelsQuery.isLoading) return

    const models = modelsQuery.data
    if (!models || models.length === 0) {
      if (!selectedModelId) {
        replaceSettings(mediaType, defaultMediaSettings[mediaType])
      }
      return
    }

    const stillValid = selectedModelId && models.some((model) => model.id === selectedModelId)
    if (!stillValid) {
      setSelectedModelId(mediaType, models[0].id)
    }
  }, [
    modelsQuery.data,
    modelsQuery.isLoading,
    mediaType,
    selectedModelId,
    setSelectedModelId,
    replaceSettings,
  ])

  useEffect(() => {
    if (!selectedModelId) return
    if (optionsQuery.isLoading) return

    if (optionsQuery.data) {
      replaceSettings(
        mediaType,
        optionsQuery.data.length > 0
          ? toTunings(optionsQuery.data)
          : defaultMediaSettings[mediaType],
      )
    }
  }, [
    selectedModelId,
    mediaType,
    optionsQuery.data,
    optionsQuery.isLoading,
    replaceSettings,
  ])

  return {
    models: modelsQuery.data ?? [],
    selectedModelId,
    setSelectedModelId: (modelId: string) => setSelectedModelId(mediaType, modelId),
    isLoadingModels: modelsQuery.isLoading,
    isLoadingOptions: optionsQuery.isLoading,
  }
}
