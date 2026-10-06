import {
  IconCameraAi,
  IconFileLambda,
  IconFolderFilled,
  IconFolderOpenFilled,
} from "@tabler/icons-react"
import {
  File,
  FileBadge,
  FileMinus,
  FilePlay,
  FileSearch,
  FileSpreadsheet,
  Image,
  Music,
  Video,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function getFileIcon(
  type: string | null | undefined,
  format?: string | null,
  name?: string,
) {
  switch (type) {
    case "document":
      if (name === "context") {
        return <FileSearch className="size-4 shrink-0 text-yellow-200" />
      }
      if (format === "json") {
        return <IconFileLambda className="size-4 shrink-0 text-green-400" />
      }
      if (format === "pdf" || format === "html" || format === "file") {
        return <IconFileLambda className="size-4 shrink-0 text-green-400" />
      }
      return <FileMinus className="size-4 shrink-0 text-blue-400" />
    case "audio":
      return <Music className="size-4 shrink-0 text-green-400" />
    case "video":
      return <Video className="size-4 shrink-0 text-green-400" />
    case "image":
      return <Image className="size-4 shrink-0 text-green-400" />
    case "video-editor":
      return <FilePlay className="size-4 shrink-0 text-pink-300" />
    case "skill":
      return <FileBadge className="size-4 shrink-0 text-yellow-200" />
    case "storyboard":
      return <FileSpreadsheet className="size-4 shrink-0 text-pink-300" />
    case "ai-generated":
      return <IconCameraAi className="size-4 shrink-0 text-yellow-300" />
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
