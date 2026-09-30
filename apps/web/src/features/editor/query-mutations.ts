import { mutationOptions, queryOptions } from "@tanstack/react-query"
import {
  deletePendingOperation,
  getFileContent,
  getPendingOperation,
  saveFileContent,
  saveSkill,
} from "./requests"
import type { CursorPaginationOptions, SaveSkillPayload } from "./requests"
import type { FileContentResponse, PendingFileOperation, Skill } from "./types"
import type { QueryClient } from "@tanstack/react-query"

const keysFactory = {
  fileContent: (
    projectId: string,
    fileId: string,
    paginationOptions?: CursorPaginationOptions,
  ) => [
    "project",
    projectId,
    "files",
    fileId,
    "content",
    { ...(paginationOptions ?? {}) },
  ],
  pendingOperations: (projectId: string) => [
    "project",
    projectId,
    "files",
    "pending-operations",
  ],
  pendingOperation: (projectId: string, fileId: string) => [
    "project",
    projectId,
    "files",
    fileId,
    "pending-operations",
  ],
}

export const getFileContentQueryOptions = (
  projectId: string,
  fileId: string,
  paginationOptions?: CursorPaginationOptions,
) =>
  queryOptions({
    queryKey: keysFactory.fileContent(projectId, fileId, paginationOptions),
    queryFn: () => getFileContent(projectId, fileId, paginationOptions),
    enabled: !!projectId && !!fileId,
  })

/**
 * Writes markdown/storyboard content into the file-content cache. Shared by the
 * save mutation's onSuccess and the autosave flush so both paths stay in sync.
 * Omit `revision` for an optimistic write that keeps the existing revision.
 */
export function writeMarkdownContentCache(
  client: QueryClient,
  projectId: string,
  fileId: string,
  data: { content: string; revision?: number },
) {
  client.setQueryData(
    keysFactory.fileContent(projectId, fileId),
    (current: FileContentResponse | undefined) => {
      if (
        current?.type === "markdown" ||
        current?.type === "storyboard" ||
        current?.type === "skill"
      ) {
        return {
          ...current,
          content: data.content,
          revision: data.revision ?? current.revision,
          updatedAt: new Date().toISOString(),
        }
      }
      return {
        type: "markdown" as const,
        id: fileId,
        name: "",
        path: "",
        content: data.content,
        revision: data.revision ?? 0,
        updatedAt: new Date().toISOString(),
      }
    },
  )
}

/** Marks a pending patch operation as applied in the cache. */
export function markPendingOperationApplied(
  client: QueryClient,
  projectId: string,
  fileId: string,
) {
  client.setQueryData(
    keysFactory.pendingOperation(projectId, fileId),
    (current: { operation: PendingFileOperation | null } | undefined) => {
      if (!current?.operation) return current
      return {
        operation: { ...current.operation, diffApplied: true },
      }
    },
  )
}

/** Merges status/visibility from the skills row into the cached skill file. */
export function writeSkillContentCache(
  client: QueryClient,
  projectId: string,
  fileId: string,
  data: Skill,
) {
  client.setQueryData(
    keysFactory.fileContent(projectId, fileId),
    (current: FileContentResponse | undefined) => {
      if (current?.type !== "skill") return current
      return {
        ...current,
        status: data.status,
        visibility: data.visibility,
        updatedAt: data.updatedAt,
      }
    },
  )
}

/**
 * Optimistically merges status/visibility so a fast switch-away-and-back
 * remounts from the latest flags, not the last server data.
 */
export function patchSkillContentCache(
  client: QueryClient,
  projectId: string,
  fileId: string,
  patch: SaveSkillPayload,
) {
  client.setQueryData(
    keysFactory.fileContent(projectId, fileId),
    (current: FileContentResponse | undefined) => {
      if (current?.type !== "skill") return current
      return {
        ...current,
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.visibility !== undefined
          ? { visibility: patch.visibility }
          : {}),
        updatedAt: new Date().toISOString(),
      }
    },
  )
}

export const saveFileContentMutationOptions = (
  projectId: string,
  fileId: string,
) =>
  mutationOptions({
    mutationFn: (data: { content: string; diffApplied?: boolean }) =>
      saveFileContent(projectId, fileId, data.content, data.diffApplied),
    onSuccess: (data, variables, _, context) => {
      writeMarkdownContentCache(context.client, projectId, fileId, {
        content: data.content,
        revision: data.revision,
      })

      if (variables.diffApplied) {
        markPendingOperationApplied(context.client, projectId, fileId)
      }
    },
  })

export const saveSkillMutationOptions = (projectId: string, fileId: string) =>
  mutationOptions({
    mutationFn: (skill: SaveSkillPayload) =>
      saveSkill(projectId, fileId, skill),
    onSuccess: (data, _var, _, context) => {
      writeSkillContentCache(context.client, projectId, fileId, data)
    },
  })

export const getPendingOperationQueryOptions = (
  projectId: string,
  fileId: string,
) =>
  queryOptions({
    queryKey: keysFactory.pendingOperation(projectId, fileId),
    queryFn: () => getPendingOperation(projectId, fileId),
    enabled: !!projectId && !!fileId,
  })

export const getFilePendingKey = (projectId: string, fileId: string) =>
  keysFactory.pendingOperation(projectId, fileId)

export const deletePendingOperationMutationOptions = (
  projectId: string,
  fileId: string,
) =>
  mutationOptions({
    mutationFn: () => deletePendingOperation(projectId, fileId),
    meta: {
      invalidateQueries: [keysFactory.pendingOperations(projectId)],
    },
    onSuccess: (_data, _var, _, context) => {
      context.client.setQueryData(
        keysFactory.pendingOperation(projectId, fileId),
        { operation: null },
      )
    },
  })
