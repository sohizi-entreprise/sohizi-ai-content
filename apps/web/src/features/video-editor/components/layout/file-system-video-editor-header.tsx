import { Paperclip } from "lucide-react"
import { Button } from "@sohizi/ui/button"
import { OutputControls } from "./output-controls"
import { SaveIndicator } from "./save-indicator"
import { attachFileToChat } from "@/features/editor/bridge/attach-file-to-chat"

interface FileSystemVideoEditorHeaderProps {
  fileName: string
  filePath: string
}

export function FileSystemVideoEditorHeader({
  fileName,
  filePath,
}: FileSystemVideoEditorHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-lg px-3 text-xs font-medium"
          onClick={() =>
            attachFileToChat({ file: { name: fileName, path: filePath } })
          }
        >
          <Paperclip className="size-3.5" />
          Attach Context
        </Button>
        <SaveIndicator />
      </div>
      <OutputControls fileName={fileName} />
    </header>
  )
}
