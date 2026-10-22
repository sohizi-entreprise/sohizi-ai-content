import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, Loader2, Play } from "lucide-react"
import { useDrag, useDragLayer, useDrop } from "react-dnd"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Button } from "@sohizi/ui/button"
import { useEditorStore } from "../../stores/editor-store"
import { getDirectoryIcon, getFileIcon } from "../../utils/get-file-icon"
import { ARBORIST_NODE_DRAG_TYPE } from "../../utils/arborist-dnd"
import { canCreateFileTypeInFolder } from "../file-node/node-menu"
import {
  DirectoryActionsMenu,
  FileActionsMenu,
} from "../file-node/file-node-actions"
import { useNewAssetDialog } from "../file-node/new-asset-dialog"
import {
  GRID_PREVIEW_SIZE,
  GRID_ROW_HEIGHT,
  GRID_TILE_GAP,
  GRID_TILE_WIDTH,
  gridColumnCount,
  gridRowWidth,
} from "./file-grid-layout"
import { createGridDragItem, moveGridItem } from "./file-grid-dnd"
import { useDirectoryGrid } from "./use-directory-grid"
import type { DirectoryChild } from "@/features/projects/type"
import type { FileNodeType } from "../../types"
import type { GridDropItem, GridNodeDragItem } from "./file-grid-dnd"
import {
  flushTimelineDropPreview,
  isPointerOverTimelineDropArea,
} from "@/features/video-editor/utils/library-dnd"
import { useEmptyDragPreview } from "@/features/video-editor/hooks/use-empty-drag-preview"
import { thumbnailImageUrl } from "@/utils/transform-url"
import { cn } from "@/lib/utils"

export type FileGridHandle = {
  createInCurrentFolder: (isDir: boolean) => void
}

type FolderCrumb = {
  id: string
  name: string
  type: string | null
}

type FileGridProps = {
  projectId: string
  rootFolderId: string
}

export const FileGrid = forwardRef<FileGridHandle, FileGridProps>(
  function FileGrid({ projectId, rootFolderId }, ref) {
    const [stack, setStack] = useState<Array<FolderCrumb>>([
      { id: rootFolderId, name: "", type: null },
    ])
    const current = stack[stack.length - 1]
    const model = useDirectoryGrid(projectId, current.id, current.type)
    const { openNewAsset, registerOnAssetCreated } = useNewAssetDialog()
    const scrollRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)
    const [dragOrder, setDragOrder] = useState<Array<string> | null>(null)
    const selectedFileId = useEditorStore((state) => state.selectedFileId)
    const openFile = useEditorStore((state) => state.openFile)
    const [, gridDrop] = useDrop<GridDropItem, void, unknown>(
      () => ({
        accept: ARBORIST_NODE_DRAG_TYPE,
        drop: (item, monitor) => {
          if (
            monitor.didDrop() ||
            !item.fromGrid ||
            !item.lastTargetId ||
            !item.order
          )
            return
          void model.reorderNode(item.id, item.order)
        },
      }),
      [model.reorderNode],
    )

    useEffect(() => {
      setStack([{ id: rootFolderId, name: "", type: null }])
    }, [rootFolderId])

    useEffect(() => {
      return registerOnAssetCreated(model.rememberChild)
    }, [model.rememberChild, registerOnAssetCreated])

    useImperativeHandle(
      ref,
      () => ({
        createInCurrentFolder: model.createInCurrentFolder,
      }),
      [model.createInCurrentFolder],
    )

    useLayoutEffect(() => {
      const element = scrollRef.current
      if (!element) return

      const updateWidth = () => {
        setWidth(Math.floor(element.clientWidth))
      }
      updateWidth()
      const observer = new ResizeObserver(updateWidth)
      observer.observe(element)
      return () => observer.disconnect()
    }, [])

    const columns = gridColumnCount(Math.max(0, width - 8))
    const itemOrder = model.items.map((item) => item.id)
    const rowCount =
      model.items.length === 0 ? 0 : Math.ceil(model.items.length / columns)
    const rowWidth = gridRowWidth(columns)
    const virtualizer = useVirtualizer({
      count: rowCount,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => GRID_ROW_HEIGHT,
      overscan: 4,
      gap: GRID_TILE_GAP,
      getItemKey: (index) => model.items[index * columns]?.id ?? index,
    })
    const virtualRows = virtualizer.getVirtualItems()
    const reachedLastRow =
      virtualRows.length > 0 &&
      virtualRows[virtualRows.length - 1].index >= rowCount - 1

    useEffect(() => {
      if (!reachedLastRow) return
      if (!model.hasNextPage || model.isFetchingNextPage) return
      void model.fetchNextPage()
    }, [
      reachedLastRow,
      model.hasNextPage,
      model.isFetchingNextPage,
      model.fetchNextPage,
    ])

    const openFolder = (node: DirectoryChild) => {
      setStack((currentStack) => [
        ...currentStack,
        { id: node.id, name: node.name, type: node.type },
      ])
    }

    const createInside = (
      node: DirectoryChild,
      isDir: boolean,
      fileType?: FileNodeType,
    ) => {
      if (fileType && !canCreateFileTypeInFolder(fileType, node.type)) return
      openFolder(node)
      model.startDraft({
        parentId: node.id,
        index: 0,
        isDir,
        fileType,
        move: { position: "start" },
      })
    }

    const insertSibling = (
      node: DirectoryChild,
      placement: "above" | "below",
      fileType: FileNodeType,
    ) => {
      if (!canCreateFileTypeInFolder(fileType, current.type)) return
      const index = model.items.findIndex((item) => item.id === node.id)
      const insertIndex = index < 0 ? model.items.length : index
      model.startDraft({
        parentId: current.id,
        index: placement === "above" ? insertIndex : insertIndex + 1,
        isDir: false,
        fileType,
        move: {
          anchorId: node.id,
          position: placement === "above" ? "before" : "after",
        },
      })
    }

    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div
          className={cn(
            "flex h-8 shrink-0 items-center gap-1 px-2",
            stack.length <= 1 && "hidden",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Back"
            disabled={stack.length <= 1}
            onClick={() =>
              setStack((currentStack) =>
                currentStack.length > 1
                  ? currentStack.slice(0, -1)
                  : currentStack,
              )
            }
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {current.name}
          </span>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-auto px-1 pb-3 scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          {model.isLoading && model.items.length === 0 ? (
            <div className="flex h-full min-h-24 items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : model.isError && model.items.length === 0 ? (
            <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2 px-3 text-center">
              <p className="text-xs text-muted-foreground">
                Couldn't load this folder
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void model.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : model.items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              This folder is empty
            </p>
          ) : (
            <div
              ref={(element) => {
                gridDrop(element)
              }}
              className="relative"
              style={{
                height: virtualizer.getTotalSize(),
                width: rowWidth,
              }}
            >
              {virtualRows.map((virtualRow) => {
                const start = virtualRow.index * columns
                const rowItems = model.items.slice(start, start + columns)
                return (
                  <div
                    key={virtualRow.key}
                    className="absolute left-0 top-0 flex"
                    style={{
                      width: rowWidth,
                      height: GRID_ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                      gap: GRID_TILE_GAP,
                    }}
                  >
                    {rowItems.map((node, columnIndex) => {
                      const originalIndex = start + columnIndex
                      const visualIndex = dragOrder
                        ? dragOrder.indexOf(node.id)
                        : originalIndex
                      const transform =
                        visualIndex >= 0 && visualIndex !== originalIndex
                          ? {
                              x:
                                ((visualIndex % columns) -
                                  (originalIndex % columns)) *
                                (GRID_TILE_WIDTH + GRID_TILE_GAP),
                              y:
                                (Math.floor(visualIndex / columns) -
                                  Math.floor(originalIndex / columns)) *
                                (GRID_ROW_HEIGHT + GRID_TILE_GAP),
                            }
                          : null
                      return (
                        <GridTile
                          key={node.id}
                          node={node}
                          itemOrder={itemOrder}
                          transform={transform}
                          parentType={current.type}
                          selected={selectedFileId === node.id}
                          editing={model.editingId === node.id}
                          onOpen={() => {
                            if (node.id.startsWith("temp-")) return
                            if (node.directory) {
                              openFolder(node)
                              return
                            }
                            openFile(node)
                          }}
                          onCommit={(name) =>
                            void model.commitName(node.id, name)
                          }
                          onCancel={model.cancelEdit}
                          onNewFolder={() => createInside(node, true)}
                          onNewFile={(type) => createInside(node, false, type)}
                          onInsert={(placement, type) =>
                            insertSibling(node, placement, type)
                          }
                          onRename={() => model.beginRename(node.id)}
                          onDelete={() => void model.deleteNode(node)}
                          onNewAsset={() => void openNewAsset(node.id)}
                          onDragOrder={setDragOrder}
                          onDragEnd={() => setDragOrder(null)}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
          {model.isFetchingNextPage ? (
            <div className="flex justify-center py-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </div>
        <FileGridDragOverlay />
      </div>
    )
  },
)

function GridTile({
  node,
  itemOrder,
  transform,
  parentType,
  selected,
  editing,
  onOpen,
  onCommit,
  onCancel,
  onNewFolder,
  onNewFile,
  onInsert,
  onRename,
  onDelete,
  onNewAsset,
  onDragOrder,
  onDragEnd,
}: {
  node: DirectoryChild
  itemOrder: Array<string>
  transform: { x: number; y: number } | null
  parentType: string | null
  selected: boolean
  editing: boolean
  onOpen: () => void
  onCommit: (name: string) => void
  onCancel: () => void
  onNewFolder: () => void
  onNewFile: (type: FileNodeType) => void
  onInsert: (placement: "above" | "below", type: FileNodeType) => void
  onRename: () => void
  onDelete: () => void
  onNewAsset: () => void
  onDragOrder: (order: Array<string>) => void
  onDragEnd: () => void
}) {
  const isTemp = node.id.startsWith("temp-")
  const [{ isDragging }, drag, preview] = useDrag<
    GridDropItem,
    void,
    { isDragging: boolean }
  >(
    () => ({
      type: ARBORIST_NODE_DRAG_TYPE,
      item: () => createGridDragItem(node, itemOrder),
      canDrag: !isTemp && !editing,
      end: () => {
        onDragEnd()
        flushTimelineDropPreview()
      },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [editing, isTemp, itemOrder, node, onDragEnd],
  )
  useEmptyDragPreview(preview)

  const [{ canDrop, isOver }, drop] = useDrop<
    GridDropItem,
    void,
    { canDrop: boolean; isOver: boolean }
  >(
    () => ({
      accept: ARBORIST_NODE_DRAG_TYPE,
      canDrop: (item) =>
        item.fromGrid === true && item.id !== node.id && !isTemp,
      hover: (item, monitor) => {
        if (!item.fromGrid || !item.order) return
        if (!monitor.isOver({ shallow: true })) return
        if (item.id === node.id || item.lastTargetId === node.id) return
        const next = moveGridItem(item.order, item.id, node.id)
        if (next === item.order) return
        item.order = next
        item.lastTargetId = node.id
        onDragOrder(next)
      },
      collect: (monitor) => ({
        canDrop: monitor.canDrop(),
        isOver: monitor.isOver({ shallow: true }),
      }),
    }),
    [isTemp, node.id, onDragOrder],
  )

  return (
    <div
      ref={(element) => {
        drag(drop(element))
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex shrink-0 cursor-grab flex-col gap-1 rounded-md p-1 text-center outline-none active:cursor-grabbing",
        selected
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        isDragging && "opacity-40",
        isOver && canDrop && "ring-2 ring-primary",
      )}
      style={{
        width: GRID_TILE_WIDTH,
        height: GRID_ROW_HEIGHT,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition: isDragging ? undefined : "transform 180ms ease",
      }}
      onClick={() => {
        if (!isDragging) onOpen()
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      {editing ? null : node.directory ? (
        <DirectoryActionsMenu
          editable={node.editable}
          folderType={node.type}
          overlay
          triggerClassName={gridMenuTriggerClassName}
          onNewFolder={onNewFolder}
          onNewFile={onNewFile}
          onNewAsset={onNewAsset}
          onRename={onRename}
          onDelete={onDelete}
        />
      ) : (
        <FileActionsMenu
          editable={node.editable}
          parentType={parentType}
          overlay
          triggerClassName={gridMenuTriggerClassName}
          onInsert={onInsert}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
      <div
        className="flex w-full items-center justify-center overflow-hidden rounded-md bg-muted/50"
        style={{ height: GRID_PREVIEW_SIZE }}
      >
        <GridPreview node={node} />
      </div>
      {editing ? (
        <GridNameInput
          defaultValue={node.name}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ) : (
        <span
          className="line-clamp-2 h-8 break-all text-xs leading-4"
          title={node.name}
        >
          {node.name}
        </span>
      )}
    </div>
  )
}

const gridMenuTriggerClassName =
  "size-6 bg-background/80 shadow-sm hover:bg-accent"

function GridNameInput({
  defaultValue,
  onCommit,
  onCancel,
}: {
  defaultValue: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const settled = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <input
      ref={inputRef}
      defaultValue={defaultValue}
      aria-label="File name"
      className="h-8 w-full rounded-sm border border-primary/50 bg-background px-1 text-center text-xs leading-4 outline-none"
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (settled.current) return
        settled.current = true
        onCommit(event.target.value)
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Enter") {
          event.preventDefault()
          if (settled.current) return
          settled.current = true
          onCommit(event.currentTarget.value)
        }
        if (event.key === "Escape") {
          event.preventDefault()
          settled.current = true
          onCancel()
        }
      }}
    />
  )
}

function GridPreview({ node }: { node: DirectoryChild }) {
  const resolvedUrl = node.previewUrl
  const [imageAttempt, setImageAttempt] = useState<
    "optimized" | "raw" | "failed"
  >("optimized")
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => {
    setImageAttempt("optimized")
    setVideoFailed(false)
  }, [resolvedUrl])

  if (resolvedUrl && imageAttempt !== "failed" && node.type === "image") {
    return (
      <img
        src={
          imageAttempt === "optimized"
            ? thumbnailImageUrl(resolvedUrl)
            : resolvedUrl
        }
        alt=""
        className="size-full object-cover"
        draggable={false}
        onError={() =>
          setImageAttempt((current) =>
            current === "optimized" ? "raw" : "failed",
          )
        }
      />
    )
  }

  if (resolvedUrl && !videoFailed && node.type === "video") {
    return (
      <div className="relative size-full">
        <video
          src={`${resolvedUrl}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
          draggable={false}
          onError={() => setVideoFailed(true)}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-6 items-center justify-center rounded-full bg-black/55 text-white">
            <Play className="size-3 fill-current" />
          </span>
        </span>
      </div>
    )
  }

  return (
    <span className="[&_svg]:size-8">
      {node.directory
        ? getDirectoryIcon(false, node.editable, node.name)
        : getFileIcon(node.type, node.format, node.name)}
    </span>
  )
}

function FileGridDragOverlay() {
  const { item, isDragging, offset, overTimeline } = useDragLayer((monitor) => {
    const clientOffset = monitor.getClientOffset()
    return {
      item: monitor.getItem() as GridNodeDragItem | null,
      isDragging: monitor.isDragging(),
      offset: monitor.getSourceClientOffset(),
      overTimeline: isPointerOverTimelineDropArea(clientOffset),
    }
  })

  if (
    !isDragging ||
    !item?.fromGrid ||
    !offset ||
    overTimeline ||
    typeof document === "undefined"
  ) {
    return null
  }

  return createPortal(
    <div
      className="pointer-events-none fixed left-0 top-0 z-100 flex flex-col gap-1 rounded-md border border-primary/50 bg-background/95 p-1 text-center shadow-xl"
      style={{
        width: GRID_TILE_WIDTH,
        height: GRID_ROW_HEIGHT,
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      }}
    >
      <div
        className="flex w-full items-center justify-center overflow-hidden rounded-md bg-muted/50"
        style={{ height: GRID_PREVIEW_SIZE }}
      >
        <GridPreview node={item.gridNode} />
      </div>
      <span className="line-clamp-2 h-8 break-all text-xs leading-4">
        {item.gridNode.name}
      </span>
    </div>,
    document.body,
  )
}
