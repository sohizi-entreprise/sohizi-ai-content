import { useCallback, useState } from 'react'
import { isAxiosError } from 'axios'
import type { FileNode } from '@/features/projects/type'
import type { AssetContent } from '@/features/editor/types'
import api from '@/lib/axios'
import { formatBytes } from '@/lib/format-bytes'

type UploadUrlResponse = {
  url: string
  storageKey: string
  maxSizeInBytes: number
}

type UploadSuccessResponse = {
  fileNode: FileNode
  asset: AssetContent & { id: string }
}

export type SaveFileBucketInput = {
  projectId: string
  folderId: string | null
  file: File
}

export type SaveFileBucketCallbacks = {
  onStart?: (input: SaveFileBucketInput) => void
  onSuccess?: (
    result: UploadSuccessResponse,
    input: SaveFileBucketInput,
  ) => void
  onError?: (error: Error, input: SaveFileBucketInput) => void
}

type SaveFileBucketOptions = SaveFileBucketCallbacks & {
  signal?: AbortSignal
}

export async function saveFileToBucket(
  { projectId, folderId, file }: SaveFileBucketInput,
  options: SaveFileBucketOptions = {},
): Promise<UploadSuccessResponse> {
  const contentType = file.type || 'application/octet-stream'

  const uploadUrlResponse = await api.get<UploadUrlResponse>(
    `/media/${projectId}/upload-url`,
    {
      params: {
        fileName: file.name,
        contentType,
      },
      signal: options.signal,
    },
  )

  const { url, storageKey, maxSizeInBytes } = uploadUrlResponse.data

  if (file.size > maxSizeInBytes) {
    throw new Error(
      `File exceeds the maximum upload size of ${formatBytes(maxSizeInBytes)}.`,
    )
  }

  const uploadResponse = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': contentType,
    },
    signal: options.signal,
  })

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to storage.')
  }

  const uploadSuccessResponse = await api.post<UploadSuccessResponse>(
    `/media/${projectId}/upload-success`,
    {
      folderId: folderId ?? null,
      storageKey,
    },
    { signal: options.signal },
  )

  return uploadSuccessResponse.data
}

export function useSaveFileBucket(callbacks: SaveFileBucketCallbacks = {}) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { onError, onStart, onSuccess } = callbacks

  const handleStart = useCallback(
    (input: SaveFileBucketInput, options?: SaveFileBucketOptions) => {
      options?.onStart?.(input)

      if (!options?.onStart) {
        onStart?.(input)
      }
    },
    [onStart],
  )

  const handleSuccess = useCallback(
    (
      result: UploadSuccessResponse,
      input: SaveFileBucketInput,
      options?: SaveFileBucketOptions,
    ) => {
      options?.onSuccess?.(result, input)

      if (!options?.onSuccess) {
        onSuccess?.(result, input)
      }
    },
    [onSuccess],
  )

  const handleError = useCallback(
    (
      cause: unknown,
      input: SaveFileBucketInput,
      options?: SaveFileBucketOptions,
    ) => {
      const normalizedError = normalizeError(cause)
      setError(normalizedError.message)
      options?.onError?.(normalizedError, input)

      if (!options?.onError) {
        onError?.(normalizedError, input)
      }

      return normalizedError
    },
    [onError],
  )

  const saveFile = useCallback(
    async (
      input: SaveFileBucketInput,
      options?: SaveFileBucketOptions,
    ): Promise<UploadSuccessResponse> => {
      setIsUploading(true)
      setError(null)
      handleStart(input, options)

      try {
        const result = await saveFileToBucket(input, options)
        handleSuccess(result, input, options)
        return result
      } catch (cause) {
        handleError(cause, input, options)
        throw cause
      } finally {
        setIsUploading(false)
      }
    },
    [handleError, handleStart, handleSuccess],
  )

  const saveFiles = useCallback(
    async (
      inputs: Array<SaveFileBucketInput>,
      options?: SaveFileBucketOptions,
    ): Promise<Array<UploadSuccessResponse>> => {
      setIsUploading(true)
      setError(null)

      try {
        return await Promise.all(
          inputs.map(async (input) => {
            handleStart(input, options)
            try {
              const result = await saveFileToBucket(input, options)
              handleSuccess(result, input, options)
              return result
            } catch (cause) {
              handleError(cause, input, options)
              throw cause
            }
          }),
        )
      } finally {
        setIsUploading(false)
      }
    },
    [handleError, handleStart, handleSuccess],
  )

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  return {
    saveFile,
    saveFiles,
    isUploading,
    error,
    resetError,
  }
}

function normalizeError(error: unknown) {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; error?: string }
      | undefined
    return new Error(data?.message ?? data?.error ?? error.message)
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Failed to upload file.')
}
