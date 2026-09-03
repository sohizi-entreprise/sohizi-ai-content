import { FilePlus, FolderPlus, Plus } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@sohizi/ui/button"
import { FileNodeMenu } from "../file-node/node-menu"
import useFileTreeBridge from "../../bridge/use-file-tree-bridge"
import { FileTree } from "./file-tree"

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

  const handleOnCreate = (action: string) => {
    if (!rootFolderId) return
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
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Files
        </span>
        <div className="flex items-center gap-0.5">
          <FileNodeMenu options={menuOptions} onChange={handleOnCreate}>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </Button>
          </FileNodeMenu>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1">
        <FileTree projectId={projectId} rootFolderId={rootFolderId} />
      </div>
    </div>
  )
}
