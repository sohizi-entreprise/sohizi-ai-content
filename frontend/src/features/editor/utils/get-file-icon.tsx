import { IconMusic, IconFileDescription, IconMovie, IconFileAi, IconFileLambda, IconFolderFilled, IconFolderOpenFilled, IconCameraAi } from "@tabler/icons-react"
import { Clapperboard, File, FileImage , FileBadge} from "lucide-react"

export function getFileIcon(format: string, name?: string) {
    switch (format) {
      case 'markdown':
        if(name === 'context'){
          return <IconFileAi className="size-4 shrink-0 text-yellow-300" />
        }
        return <IconFileDescription className="size-4 shrink-0 text-blue-400" />
      case 'audio':
        return <IconMusic className="size-4 shrink-0 text-green-400" />
      case 'video':
        return <IconMovie className="size-4 shrink-0 text-purple-400" />
      case 'image':
        return <FileImage className="size-4 shrink-0 text-indigo-400" />
      case 'document':
        return <IconFileLambda className="size-4 shrink-0 text-pink-400" />
      case 'video-editor':
        return <Clapperboard className="size-4 shrink-0 text-yellow-300" />
      case 'ai-generated':
        return <IconCameraAi className="size-4 shrink-0 text-yellow-300" />
      
      case 'skill':
        return <FileBadge className="size-4 shrink-0 text-yellow-300" />
      default:
        return <File className="size-4 shrink-0 text-muted-foreground" />
    }
}

export function getDirectoryIcon(isOpen: boolean, _isEditable: boolean) {
    switch (true) {
      case isOpen:
        return <IconFolderOpenFilled className="size-4 shrink-0 text-muted-foreground" />
      default:
        return <IconFolderFilled className="size-4 shrink-0 text-muted-foreground" />
    }
}
 