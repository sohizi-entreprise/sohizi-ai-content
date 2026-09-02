import {
  IconCameraAi,
  IconFileAi,
  IconFileDescription,
  IconFileLambda,
  IconFolderFilled,
  IconFolderOpenFilled,
  IconMovie,
  IconMusic,
} from "@tabler/icons-react"
import { Clapperboard, File, FileBadge, FileImage } from "lucide-react"
import { cn } from "@/lib/utils"

export function getFileIcon(format: string, name?: string) {
  switch (format) {
    case "markdown":
      if (name === "context") {
        return <IconFileAi className="size-4 shrink-0 text-yellow-300" />
      }
      return <IconFileDescription className="size-4 shrink-0 text-blue-400" />
    case "audio":
      return <IconMusic className="size-4 shrink-0 text-green-400" />
    case "video":
      // text-purple-400
      return <IconMovie className="size-4 shrink-0 text-green-400" />
    case "image":
      // text-indigo-400
      return <FileImage className="size-4 shrink-0 text-green-400" />
    case "document":
      // text-pink-400
      return <IconFileLambda className="size-4 shrink-0 text-green-400" />
    case "video-editor":
      // text-yellow-300
      return <Clapperboard className="size-4 shrink-0 text-pink-300" />
    case "ai-generated":
      // text-yellow-300
      return <IconCameraAi className="size-4 shrink-0 text-yellow-300" />

    case "skill":
      return <FileBadge className="size-4 shrink-0 text-yellow-300" />
    default:
      return <File className="size-4 shrink-0 text-muted-foreground" />
  }
}

export function getDirectoryIcon(
  isOpen: boolean,
  isEditable: boolean,
  name: string,
) {
  const isCoreFolder = name.toLowerCase() === "core" && !isEditable
  switch (true) {
    case isOpen:
      return (
        <IconFolderOpenFilled
          className={cn(
            "size-4 shrink-0 text-muted-foreground",
            isCoreFolder ? "text-blue-400" : "",
          )}
        />
      )
    default:
      return (
        <IconFolderFilled
          className={cn(
            "size-4 shrink-0 text-muted-foreground",
            isCoreFolder ? "text-blue-400" : "",
          )}
        />
      )
  }
}
