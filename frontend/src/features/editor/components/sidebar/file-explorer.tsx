import { Plus, FilePlus, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTree } from './file-tree'
import { FileNodeMenu } from '../file-node/node-menu'
import useFileTreeBridge from '../../bridge/use-file-tree-bridge'

interface FileExplorerProps {
  projectId: string
  rootFolderId: string
}

const menuOptions = [
  {label: 'New file', value: 'new-file', icon: <FilePlus className="size-4" />},
  {label: 'New folder', value: 'new-folder', icon: <FolderPlus className="size-4" />},
]

export function FileExplorer({ projectId, rootFolderId }: FileExplorerProps) {

  const runCommand = useFileTreeBridge((s) => s.runCommand)

  const handleOnCreate = (action: string) => {
    if(!rootFolderId) return;
    switch (action) {
      case 'new-file':
        runCommand({type: 'create', data: {projectId, parentId: rootFolderId, index: 0, isDir: false}})
        break;
      case 'new-folder':
        runCommand({type: 'create', data: {projectId, parentId: rootFolderId, index: 0, isDir: true}})
        break;
      default:
        break;
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <FileNodeMenu options={menuOptions} 
                        onChange={handleOnCreate}
          >
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
              <Plus className="size-3.5" />
            </Button>
          </FileNodeMenu>
        </div>
      </div>
      <ScrollArea className="flex-1 px-1">
        <FileTree projectId={projectId} rootFolderId={rootFolderId} />
      </ScrollArea>
    </div>
  )
}


