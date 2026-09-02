import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"
import { deleteGenerationRequestMutationOptions } from "../query-mutations"
import { useMediaGeneratorStore } from "../store/media-generator-store"

export const useRequestActions = (
  projectId: string,
  requestId: string,
  request: Record<string, unknown> | null,
) => {
  const { mutate: deleteMutate } = useMutation(
    deleteGenerationRequestMutationOptions(projectId, requestId),
  )
  const applyRequestState = useMediaGeneratorStore(
    (state) => state.applyRequestState,
  )

  const onDelete = useCallback(() => {
    const ok = confirm("Are you sure you want to delete this asset?")
    if (!ok) return
    deleteMutate()
  }, [deleteMutate])

  const onReuseSettings = useCallback(() => {
    applyRequestState(request)
  }, [applyRequestState, request])

  return {
    onDelete,
    onReuseSettings,
  }
}
