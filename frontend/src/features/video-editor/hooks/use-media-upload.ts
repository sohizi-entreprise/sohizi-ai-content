import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useVideoEditorStore } from '../store/editor-store'
import { uploadMediaAsset } from '../requests'
import { secondsToFrames } from '../utils/time'
import { probeImageDimensions, probeMediaDuration } from '../utils/media-probe'
import { useFileTreeStore } from '@/features/editor/stores/file-tree-store'
import { projectAssetsKey } from '@/features/projects/query-mutation'

const IMAGE_DURATION_SEC = 5

/**
 * Uploads dropped/picked files into the project bucket and appends the
 * resulting clips to the composition.
 */
export function useMediaUpload(projectId: string) {
  const [uploadingCount, setUploadingCount] = useState(0)
  const queryClient = useQueryClient()

  const fps = useVideoEditorStore((s) => s.fps)
  const addVideoClip = useVideoEditorStore((s) => s.addVideoClip)
  const addAudioClip = useVideoEditorStore((s) => s.addAudioClip)
  const addImageClip = useVideoEditorStore((s) => s.addImageClip)
  const rootFolderId = useFileTreeStore((s) => s.rootFolderId)

  const uploadFiles = useCallback(
    async (files: FileList | Array<File> | null) => {
      if (!files) return
      const list = Array.from(files)
      if (list.length === 0) return

      if (!rootFolderId) {
        toast.error('Project files are still loading. Try again in a moment.')
        return
      }

      let uploadedAny = false

      for (const file of list) {
        const localUrl = URL.createObjectURL(file)
        try {
          setUploadingCount((count) => count + 1)

          if (file.type.startsWith('video/')) {
            const seconds = await probeMediaDuration(localUrl, 'video')
            const asset = await uploadMediaAsset(projectId, rootFolderId, file)
            addVideoClip({
              url: asset.url,
              fileName: asset.name,
              durationInFrames: secondsToFrames(seconds, fps),
            })
            uploadedAny = true
          } else if (file.type.startsWith('audio/')) {
            const seconds = await probeMediaDuration(localUrl, 'audio')
            const asset = await uploadMediaAsset(projectId, rootFolderId, file)
            addAudioClip({
              url: asset.url,
              fileName: asset.name,
              durationInFrames: secondsToFrames(seconds, fps),
            })
            uploadedAny = true
          } else if (file.type.startsWith('image/')) {
            const dims = await probeImageDimensions(localUrl)
            const asset = await uploadMediaAsset(projectId, rootFolderId, file)
            addImageClip({
              url: asset.url,
              fileName: asset.name,
              width: dims.width,
              height: dims.height,
              durationInFrames: fps * IMAGE_DURATION_SEC,
            })
            uploadedAny = true
          } else {
            toast.error(`${file.name} is not a supported media file`)
          }
        } catch {
          toast.error(`Could not upload ${file.name}`)
        } finally {
          URL.revokeObjectURL(localUrl)
          setUploadingCount((count) => count - 1)
        }
      }

      if (uploadedAny) {
        void queryClient.invalidateQueries({
          queryKey: projectAssetsKey(projectId),
        })
      }
    },
    [
      addAudioClip,
      addImageClip,
      addVideoClip,
      fps,
      projectId,
      queryClient,
      rootFolderId,
    ],
  )

  return {
    uploadFiles,
    isUploading: uploadingCount > 0,
  }
}
