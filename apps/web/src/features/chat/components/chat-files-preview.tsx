import {
  IconFile,
  IconFileMusic,
  IconFileTypePdf,
  IconFileTypeTxt,
  IconMovie,
  IconX,
} from "@tabler/icons-react"
import { useChatStore } from "../store/chat-store"
import type { AttachedFile } from "@/components/widgets/file-attachments"
import { DotsLoader } from "@sohizi/ui/loaders"
import { Button } from "@sohizi/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  onRemoveFile: (id: string) => void
}

export default function ChatFilesPreview({ className, onRemoveFile }: Props) {
  const attachedFiles = useChatStore((state) => state.attachedFiles)

  return (
    <div className={cn("grid grid-cols-5 gap-4 w-full", className)}>
      {attachedFiles.map((file) => (
        <div
          key={file.id}
          className="aspect-3/4 rounded relative"
        >
          <RenderFileType file={file} />
          {file.status === "pending" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <DotsLoader bgColor="bg-white" />
            </div>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            className="size-6 rounded-full border-white/10! absolute -top-2 -right-2"
            onClick={() => onRemoveFile(file.id)}
          >
            <IconX className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

const RenderFileType = ({ file }: { file: AttachedFile }) => {
  switch (true) {
    case file.type.startsWith("image/"):
      return (
        <img
          src={file.preview || (file.status === "uploaded" && file.url) || ""}
          alt={file.id}
          className="w-full h-full object-contain"
        />
      )
    case file.type.startsWith("video/"):
      return (
        <div className="w-full h-full flex items-center justify-center">
          <IconMovie className="size-4" />
        </div>
      )
    case file.type.startsWith("audio/"):
      return (
        <div className="w-full h-full flex items-center justify-center">
          <IconFileMusic className="size-4" />
        </div>
      )
    case file.type.startsWith("application/pdf"):
      return (
        <div className="w-full h-full flex items-center justify-center">
          <IconFileTypePdf className="size-4" />
        </div>
      )
    case file.type.startsWith("text/plain"):
      return (
        <div className="w-full h-full flex items-center justify-center">
          <IconFileTypeTxt className="size-4" />
        </div>
      )
    default:
      return (
        <div className="w-full h-full flex items-center justify-center">
          <IconFile className="size-4" />
        </div>
      )
  }
}
