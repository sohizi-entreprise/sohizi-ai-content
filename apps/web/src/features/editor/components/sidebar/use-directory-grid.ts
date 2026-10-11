import { useEffect, useRef, useState } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import {
  appendDirectoryChild,
  removeDirectoryChild,
  reorderDirectoryChildren,
  updateDirectoryChild,
} from "../../stores/directory-children-cache"
import { getDirChildren } from "../../stores/file-tree-cache"
import { useEditorStore } from "../../stores/editor-store"
import { defaultFormatForType } from "../../utils/file-kind"
import { buildGridItems } from "./file-grid-layout"
import type { GridDraft } from "./file-grid-layout"
import type { DirectoryChild, FileNode } from "@/features/projects/type"
import type { FileNodeType } from "../../types"
import {
  createFileNodeMutationOptions,
  deleteFileNodeMutationOptions,
  directoryChildrenKey,
  fileTreeKey,
  getlistFileTreePerDirectoryOptions,
  listDirectoryChildrenQueryOptions,
  moveFileNodeMutationOptions,
  renameFileNodeMutationOptions,
} from "@/features/projects/query-mutation"
import { listFileTreePerDirectory } from "@/features/projects/request"
import { useFileUpload } from "@/hooks/use-file-upload"
import { useSaveFileBucket } from "@/hooks/use-save-file-bucket"

const MAX_CHILDREN_PER_DIRECTORY = 100

export type StartDraftInput = {
  parentId: string
  index: number
  isDir: boolean
  fileType?: FileNodeType
  move?: GridDraft["move"]
}

export function useDirectoryGrid(
  projectId: string,
  folderId: string,
  folderType: string | null,
) {
  const queryClient = useQueryClient()
  const query = useInfiniteQuery(
    listDirectoryChildrenQueryOptions(projectId, folderId),
  )
  const [draft, setDraft] = useState<GridDraft | null>(null)
  const [pinned, setPinned] = useState<Array<DirectoryChild>>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const uploadFolderId = useRef(folderId)
  const createMutation = useMutation(createFileNodeMutationOptions(projectId))
  const renameMutation = useMutation(renameFileNodeMutationOptions(projectId))
  const moveMutation = useMutation(moveFileNodeMutationOptions(projectId))
  const deleteMutation = useMutation(deleteFileNodeMutationOptions(projectId))
  const openFile = useEditorStore((state) => state.openFile)
  const { saveFile } = useSaveFileBucket()

  const visibleDraft = draft?.node.parentId === folderId ? draft : null
  const visiblePinned = pinned.filter((node) => node.parentId === folderId)

  const serverItems = query.data?.pages.flatMap((page) => page.data) ?? []
  const serverKey = serverItems.map((item) => item.id).join("\0")

  useEffect(() => {
    const ids = new Set(serverKey ? serverKey.split("\0") : [])
    setPinned((current) => {
      const next = current.filter((node) => !ids.has(node.id))
      return next.length === current.length ? current : next
    })
  }, [serverKey])

  const items = buildGridItems(serverItems, visibleDraft, visiblePinned)
  const loadedCount =
    serverItems.length +
    visiblePinned.filter(
      (node) => !serverItems.some((item) => item.id === node.id),
    ).length

  const rememberChild = (parentId: string, node: DirectoryChild) => {
    if (parentId === folderId) {
      setPinned((current) =>
        current.some((item) => item.id === node.id)
          ? current
          : [...current, node],
      )
    }
    appendDirectoryChild(queryClient, projectId, parentId, node)
    void queryClient.invalidateQueries({
      queryKey: directoryChildrenKey(projectId, parentId),
    })
    void queryClient.invalidateQueries({
      queryKey: fileTreeKey(projectId, parentId),
      refetchType: "all",
    })
  }

  const startDraft = (input: StartDraftInput) => {
    const node = createTempDirectoryChild(projectId, input)
    setDraft({ node, insertIndex: input.index, move: input.move })
    setEditingId(node.id)
  }

  const cancelEdit = () => {
    if (draft && editingId === draft.node.id) setDraft(null)
    setEditingId(null)
  }

  const commitName = async (id: string, name: string) => {
    const trimmed = name.trim()
    if (draft?.node.id === id) {
      if (!trimmed) {
        setDraft(null)
        setEditingId(null)
        return
      }
      await commitDraft(draft, trimmed)
      return
    }

    if (!trimmed) {
      setEditingId(null)
      return
    }
    await commitRename(id, trimmed)
  }

  const commitDraft = async (currentDraft: GridDraft, name: string) => {
    const node = currentDraft.node
    const parentId = node.parentId ?? folderId
    setEditingId(null)
    try {
      const position = await nextCreatePosition(
        queryClient,
        projectId,
        parentId,
      )
      let created = await createMutation.mutateAsync({
        name,
        directory: node.directory,
        parentId,
        position,
        type: node.directory ? null : (node.type ?? "document"),
        format: node.directory
          ? null
          : (node.format ?? defaultFormatForType(node.type ?? "document")),
      })
      if (currentDraft.move) {
        try {
          created = await moveMutation.mutateAsync({
            fileId: created.id,
            parentId,
            anchorId: currentDraft.move.anchorId,
            position: currentDraft.move.position,
          })
        } catch (error) {
          console.error("Failed to position created file node:", error)
          toast.warning("Created the item, but couldn't place it there")
        }
      }
      const child = toDirectoryChild(created, null)
      setDraft(null)
      rememberChild(parentId, child)
      if (!child.directory) openFile(child)
    } catch (error) {
      console.error("Failed to create file node:", error)
      toast.error("Couldn't create file")
      setEditingId(node.id)
    }
  }

  const commitRename = async (id: string, name: string) => {
    const current =
      serverItems.find((item) => item.id === id) ??
      pinned.find((item) => item.id === id)
    if (!current || current.name === name) {
      setEditingId(null)
      return
    }

    const parentId = current.parentId ?? folderId
    updateDirectoryChild(queryClient, projectId, parentId, id, { name })
    setPinned((nodes) =>
      nodes.map((node) => (node.id === id ? { ...node, name } : node)),
    )
    setEditingId(null)

    try {
      const updated = await renameMutation.mutateAsync({ fileId: id, name })
      updateDirectoryChild(queryClient, projectId, parentId, id, {
        name: updated.name,
        path: updated.path,
      })
      setPinned((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, name: updated.name, path: updated.path }
            : node,
        ),
      )
      useEditorStore.getState().updateTab(id, {
        name: updated.name,
        path: updated.path,
        oldPath: current.path,
      })
      void queryClient.invalidateQueries({
        // A folder rename also changes the paths of cached descendants.
        queryKey: current.directory
          ? ["project", projectId, "file-tree"]
          : fileTreeKey(projectId, parentId),
        refetchType: "all",
      })
    } catch (error) {
      console.error("Failed to rename:", error)
      toast.error("Couldn't rename")
      updateDirectoryChild(queryClient, projectId, parentId, id, {
        name: current.name,
        path: current.path,
      })
      setPinned((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, name: current.name, path: current.path }
            : node,
        ),
      )
    }
  }

  const reorderNode = async (id: string, orderedIds: Array<string>) => {
    const source = items.find((item) => item.id === id)
    const nextIndex = orderedIds.indexOf(id)
    if (!source || source.parentId !== folderId || nextIndex < 0) return

    const anchorId = nextIndex === 0 ? undefined : orderedIds[nextIndex - 1]
    const position = nextIndex === 0 ? "start" : "after"

    reorderDirectoryChildren(queryClient, projectId, folderId, orderedIds)

    try {
      await moveMutation.mutateAsync({
        fileId: id,
        parentId: folderId,
        anchorId,
        position,
      })
    } catch (error) {
      console.error("Failed to reorder file node:", error)
      toast.error("Couldn't reorder the item")
    } finally {
      void queryClient.invalidateQueries({
        queryKey: directoryChildrenKey(projectId, folderId),
      })
      void queryClient.invalidateQueries({
        queryKey: fileTreeKey(projectId, folderId),
        // The list layout is normally unmounted while the grid is visible.
        // Refetch inactive entries as well so switching layouts immediately
        // receives the server's canonical order.
        refetchType: "all",
      })
    }
  }

  const deleteNode = async (node: DirectoryChild) => {
    if (node.id.startsWith("temp-")) {
      setDraft(null)
      setEditingId(null)
      return
    }

    const confirmed = window.confirm(
      node.directory
        ? `Delete folder "${node.name}" and all of its contents? This cannot be undone.`
        : `Delete file "${node.name}"? This cannot be undone.`,
    )
    if (!confirmed) return

    const parentId = node.parentId ?? folderId
    removeDirectoryChild(queryClient, projectId, parentId, node.id)
    setPinned((nodes) => nodes.filter((item) => item.id !== node.id))

    try {
      await deleteMutation.mutateAsync(node.id)
      closeDeletedTabs(node)
      void queryClient.invalidateQueries({
        queryKey: directoryChildrenKey(projectId, parentId),
      })
      void queryClient.invalidateQueries({
        queryKey: fileTreeKey(projectId, parentId),
        refetchType: "all",
      })
    } catch (error) {
      console.error("Failed to delete:", error)
      toast.error("Couldn't delete")
      void queryClient.invalidateQueries({
        queryKey: directoryChildrenKey(projectId, parentId),
      })
      void queryClient.invalidateQueries({
        queryKey: fileTreeKey(projectId, parentId),
        refetchType: "all",
      })
    }
  }

  const [_uploadState, { openFileDialog, getInputProps }] = useFileUpload({
    multiple: false,
    accept: "image/*,video/*,audio/*,text/plain,.docx",
    maxSize: 20 * 1024 * 1024,
    onFilesAdded: (added) => {
      const targetId = uploadFolderId.current
      if (targetId === folderId && loadedCount >= MAX_CHILDREN_PER_DIRECTORY) {
        toast.error("Maximum number of children reached")
        return
      }

      for (const file of added) {
        saveFile(
          { projectId, folderId: targetId, file: file.file as File },
          {
            onSuccess: (result) => {
              const previewUrl =
                result.fileNode.type === "image" ||
                result.fileNode.type === "video"
                  ? result.asset.url
                  : null
              rememberChild(
                targetId,
                toDirectoryChild(result.fileNode, previewUrl),
              )
            },
            onError: (error) => {
              toast.error(error.message)
            },
          },
        )
      }
    },
    onError: (error) => {
      toast.error(error)
    },
  })

  const openUpload = async (targetFolderId: string) => {
    try {
      const children = await queryClient.ensureQueryData(
        getlistFileTreePerDirectoryOptions(projectId, targetFolderId),
      )
      if (children.length >= MAX_CHILDREN_PER_DIRECTORY) {
        toast.error("Maximum number of children reached")
        return
      }
      uploadFolderId.current = targetFolderId
      openFileDialog()
    } catch (error) {
      console.error("Failed to check folder before upload:", error)
      toast.error("Couldn't open the upload")
    }
  }

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    editingId,
    draft,
    startDraft,
    cancelEdit,
    commitName,
    beginRename: (id: string) => setEditingId(id),
    deleteNode,
    reorderNode,
    openUpload,
    getInputProps,
    createInCurrentFolder: (isDir: boolean) => {
      startDraft({
        parentId: folderId,
        index: 0,
        isDir,
        fileType: folderType === "skill" ? "skill" : "document",
        move: { position: "start" },
      })
    },
  }
}

function createTempDirectoryChild(
  projectId: string,
  input: StartDraftInput,
): DirectoryChild {
  const fileType = input.fileType ?? "document"
  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    directory: input.isDir,
    projectId,
    type: input.isDir ? null : fileType,
    format: input.isDir ? null : defaultFormatForType(fileType),
    parentId: input.parentId,
    position: input.index * 1000,
    editable: true,
    contentEditable: true,
    path: "",
    previewUrl: null,
  }
}

function toDirectoryChild(
  node: FileNode,
  previewUrl: string | null,
): DirectoryChild {
  return {
    ...node,
    previewUrl:
      node.type === "image" || node.type === "video" ? previewUrl : null,
  }
}

async function nextCreatePosition(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  parentId: string,
) {
  const cached = getDirChildren(queryClient, projectId, parentId)
  const siblings = cached
    ? cached.filter((node) => !node.id.startsWith("temp-"))
    : await listFileTreePerDirectory(projectId, parentId)
  return (siblings.length + 1) * 1000
}

function closeDeletedTabs(node: {
  id: string
  directory: boolean
  path: string
}) {
  const { openTabs, closeTab } = useEditorStore.getState()
  const ids = openTabs
    .filter((tab) => {
      if (tab.id === node.id) return true
      if (!node.directory || node.path === "") return false
      return tab.path === node.path || tab.path.startsWith(`${node.path}/`)
    })
    .map((tab) => tab.id)

  for (const id of ids) closeTab(id)
}
