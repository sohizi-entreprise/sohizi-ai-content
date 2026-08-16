import { MediaModelSelector } from './media-model-selector'
import { useMediaCatalog } from '../hooks/use-media-catalog'

/** @deprecated Settings now live in MediaModelSettings. Kept for typecheck compatibility. */
export default function SettingsPopover() {
  const {
    models,
    selectedModelId,
    setSelectedModelId,
    isLoadingModels,
    hasCatalog,
  } = useMediaCatalog()

  if (!hasCatalog) return null

  return (
    <MediaModelSelector
      models={models}
      selectedModelId={selectedModelId}
      onSelect={setSelectedModelId}
      isLoading={isLoadingModels}
    />
  )
}
