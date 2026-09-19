import { fileRefLabel } from "../lib/tool-call-file-ref"
import type { FileRef } from "../lib/tool-call-file-ref"
import type { MouseEvent } from "react"
import { useEditorStore } from "@/features/editor/stores/editor-store"

type ToolFileTagProps = {
  fileRef: FileRef
}

export function ToolFileTag({ fileRef }: ToolFileTagProps) {
  const label = fileRefLabel(fileRef)

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (fileRef.kind === "path") {
      void useEditorStore.getState().openFileByPath(fileRef.path)
      return
    }
    void useEditorStore.getState().openFileById(fileRef.id)
  }

  return (
    <button
      type="button"
      className="cursor-pointer font-semibold text-muted-foreground underline-offset-1 hover:text-foreground hover:underline"
      onClick={handleClick}
    >
      {label}
    </button>
  )
}
