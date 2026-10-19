import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { IconCaretDownFilled, IconCaretRightFilled } from "@tabler/icons-react"
import { useEditorStore } from "../../stores/editor-store"
import { appendDirectoryChild } from "../../stores/directory-children-cache"
import { insertNodeAt as insertNodeInCache } from "../../stores/file-tree-cache"
import { getDirectoryIcon } from "../../utils/get-file-icon"
import { canCreateFileTypeInFolder } from "./node-menu"
import { DirectoryActionsMenu } from "./file-node-actions"
import type { FileNodeType, NodeProps } from "../../types"
import {
  directoryChildrenKey,
  getlistFileTreePerDirectoryOptions,
} from "@/features/projects/query-mutation"
import { cn } from "@/lib/utils"
import { useFileUpload } from "@/hooks/use-file-upload"
import { useSaveFileBucket } from "@/hooks/use-save-file-bucket"

const MAX_CHILDREN_PER_DIRECTORY = 100

export function DirectoryNode(props: NodeProps) {
  const { node, tree, onCreateFile, style, dragHandle } = props
  const nameInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { openFileDialog, getInputProps } = useHandleUploadFile({
    projectId: node.data.projectId,
    node,
  })
  const selectedFileId = useEditorStore((s) => s.selectedFileId)
  const openFile = useEditorStore((s) => s.openFile)
  const isSelected = selectedFileId === node.data.id
  const isDir = node.data.directory

  useEffect(() => {
    if (!node.isEditing) return
    const frame = requestAnimationFrame(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [node.isEditing])

  useDirectoryChildren(node.data.projectId, node.data.id, isDir && node.isOpen)

  const handleClick = () => {
    if (isDir) {
      node.toggle()
    } else {
      openFile(node.data)
    }
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") node.submit((e.target as HTMLInputElement).value)
    if (e.key === "Escape") node.reset()
  }

  const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    node.submit(e.target.value)
  }

  const onInputClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
  }

  const ensureChildrenLoaded = () =>
    queryClient.ensureQueryData(
      getlistFileTreePerDirectoryOptions(node.data.projectId, node.data.id),
    )

  const createFile = async (type: FileNodeType) => {
    if (!canCreateFileTypeInFolder(type, node.data.type)) return
    if (!node.isOpen) node.open()
    await ensureChildrenLoaded()
    onCreateFile(node.data.id, 0, false, type)
  }

  const createFolder = async () => {
    if (!node.isOpen) node.open()
    await ensureChildrenLoaded()
    onCreateFile(node.data.id, 0, true)
  }

  return (
    <>
      <div
        ref={dragHandle}
        style={style}
        className={cn(
          "group flex min-w-0 w-full cursor-pointer items-center gap-1 overflow-hidden rounded-sm px-1 py-0.5 text-sm",
          isSelected
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        onClick={(event) => {
          if (event.button === 0) handleClick()
        }}
        data-type={node.data.type}
        data-format={node.data.format}
        data-fileid={node.data.id}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {node.isOpen ? (
            <IconCaretDownFilled className="size-3" />
          ) : (
            <IconCaretRightFilled className="size-3" />
          )}
        </span>

        {getDirectoryIcon(node.isOpen, node.data.editable, node.data.name)}

        {node.isEditing ? (
          <input
            ref={nameInputRef}
            className="min-w-0 flex-1 rounded-sm border border-primary/50 bg-background px-1 text-sm outline-none"
            defaultValue={node.data.name}
            onBlur={onInputBlur}
            onKeyDown={onInputKeyDown}
            onClick={onInputClick}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate" title={node.data.name}>
            {node.data.name}
          </span>
        )}
        {node.isEditing ? null : (
          <DirectoryActionsMenu
            editable={node.data.editable}
            folderType={node.data.type}
            onNewFolder={createFolder}
            onNewFile={createFile}
            onUpload={openFileDialog}
            onRename={() => node.edit()}
            onDelete={() => tree.delete(node.id)}
          />
        )}
      </div>
      <input {...getInputProps()} className="sr-only" />
    </>
  )
}

function useDirectoryChildren(
  projectId: string,
  dirId: string,
  enabled: boolean,
) {
  return useQuery({
    ...getlistFileTreePerDirectoryOptions(projectId, dirId),
    enabled,
  })
}

function useHandleUploadFile(
  params: { projectId: string } & Pick<NodeProps, "node">,
) {
  const { projectId, node } = params
  const queryClient = useQueryClient()
  const { saveFile } = useSaveFileBucket()
  const [_state, { openFileDialog, getInputProps }] = useFileUpload({
    multiple: false,
    accept: "image/*,video/*,audio/*,text/plain,.docx",
    maxSize: 20 * 1024 * 1024, // 5MB
    onFilesAdded: (data) => {
      const totalChildren = node.children?.length ?? 0
      if (totalChildren === MAX_CHILDREN_PER_DIRECTORY) {
        toast.error("Maximum number of children reached")
        return
      }

      for (const file of data) {
        saveFile(
          { projectId, folderId: node.id, file: file.file as File },
          {
            onSuccess: (result) => {
              const fileNode = result.fileNode
              if (!fileNode) return
              insertNodeInCache(
                queryClient,
                projectId,
                node.id,
                fileNode,
                totalChildren,
              )
              appendDirectoryChild(queryClient, projectId, node.id, {
                ...fileNode,
                previewUrl:
                  fileNode.type === "image" || fileNode.type === "video"
                    ? result.asset.url
                    : null,
              })
              void queryClient.invalidateQueries({
                queryKey: directoryChildrenKey(projectId, node.id),
              })
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

  return {
    openFileDialog,
    getInputProps,
  }
}
