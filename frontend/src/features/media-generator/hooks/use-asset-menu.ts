import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'

import {
  deleteAssetMutationOptions,
  moveAssetToFolderMutationOptions,
} from '../query-mutations'
import { getAssetDownloadUrl } from '../requests'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import type { MediaAsset } from '../requests'

export const useAssetMenu = (projectId: string, asset: MediaAsset) => {
  const { mutate: deleteMutate } = useMutation(
    deleteAssetMutationOptions(projectId, asset.id),
  )
  const { mutateAsync: moveMutate } = useMutation(
    moveAssetToFolderMutationOptions(projectId, asset.id),
  )
  const applyRequestState = useMediaGeneratorStore((state) => state.applyRequestState)

  const onDelete = useCallback(() => {
    const ok = confirm('Are you sure you want to delete this asset?')
    if (!ok) return
    deleteMutate()
  }, [deleteMutate])

  const onMoveToFolder = useCallback(
    async (folderId: string) => {
      try {
        await moveMutate(folderId)
        return { ok: true }
      } catch {
        return { ok: false }
      }
    },
    [moveMutate],
  )

  const onReuseSettings = useCallback(() => {
    applyRequestState(asset.generationRequest?.request ?? null)
  }, [asset.generationRequest?.request, applyRequestState])

  const onDownload = useCallback(async () => {
    try {
      const { url } = await getAssetDownloadUrl(projectId, asset.id)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = asset.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }, [projectId, asset.id, asset.name])

  return {
    onDelete,
    onMoveToFolder,
    onReuseSettings,
    onDownload,
  }
}
