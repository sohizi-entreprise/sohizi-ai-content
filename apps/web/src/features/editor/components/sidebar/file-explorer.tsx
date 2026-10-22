import { useRef, useState } from "react"
import { FilePlus, FolderPlus } from "lucide-react"
import {
  IconColumns2Filled,
  IconLayoutListFilled,
  IconSquareRoundedPlusFilled,
} from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@sohizi/ui/button"
import { FileNodeMenu } from "../file-node/node-menu"
import useFileTreeBridge from "../../bridge/use-file-tree-bridge"
import { NewAssetDialogProvider } from "../file-node/new-asset-dialog"
import { FileGrid } from "./file-grid"
import { FileTree } from "./file-tree"
import type { FileGridHandle } from "./file-grid"
import { cn } from "@/lib/utils"

interface FileExplorerProps {
  projectId: string
  rootFolderId: string
}

const menuOptions = [
  {
    label: "New file",
    value: "new-file",
    icon: <FilePlus className="size-4" />,
  },
  {
    label: "New folder",
    value: "new-folder",
    icon: <FolderPlus className="size-4" />,
  },
]

export function FileExplorer({ projectId, rootFolderId }: FileExplorerProps) {
  const runCommand = useFileTreeBridge((s) => s.runCommand)
  const queryClient = useQueryClient()
  const [view, setView] = useState<"list" | "grid">("list")
  const gridRef = useRef<FileGridHandle>(null)

  const handleOnCreate = (action: string) => {
    if (!rootFolderId) return
    if (view === "grid") {
      gridRef.current?.createInCurrentFolder(action === "new-folder")
      return
    }
    switch (action) {
      case "new-file":
        runCommand(
          {
            type: "create",
            data: { projectId, parentId: rootFolderId, index: 0, isDir: false },
          },
          queryClient,
        )
        break
      case "new-folder":
        runCommand(
          {
            type: "create",
            data: { projectId, parentId: rootFolderId, index: 0, isDir: true },
          },
          queryClient,
        )
        break
      default:
        break
    }
  }

  return (
    <NewAssetDialogProvider projectId={projectId}>
      <div className="flex h-full min-w-0 flex-col gap-2 overflow-hidden">
        <div className="flex h-10 shrink-0 items-center justify-between px-4 border-b">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Files
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="List view"
              aria-pressed={view === "list"}
              className={cn(
                "size-6 text-muted-foreground hover:text-foreground cursor-pointer",
                view === "list" && "bg-accent text-foreground",
              )}
              onClick={() => setView("list")}
            >
              <IconLayoutListFilled className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              className={cn(
                "size-6 text-muted-foreground hover:text-foreground cursor-pointer",
                view === "grid" && "bg-accent text-foreground",
              )}
              onClick={() => setView("grid")}
            >
              <IconColumns2Filled className="size-4" />
            </Button>
            <FileNodeMenu options={menuOptions} onChange={handleOnCreate}>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-foreground hover:text-foreground cursor-pointer"
              >
                <IconSquareRoundedPlusFilled className="size-5" />
              </Button>
            </FileNodeMenu>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1">
          {view === "list" ? (
            <FileTree projectId={projectId} rootFolderId={rootFolderId} />
          ) : (
            <FileGrid
              ref={gridRef}
              projectId={projectId}
              rootFolderId={rootFolderId}
            />
          )}
        </div>
      </div>
    </NewAssetDialogProvider>
  )
}
