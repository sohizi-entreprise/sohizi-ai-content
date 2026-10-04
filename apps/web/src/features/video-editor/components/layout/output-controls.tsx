import { Separator } from "@sohizi/ui/separator"
import { AspectRatioPicker } from "../stage/aspect-ratio-picker"
import { ExportButton } from "./export-button"
import { FpsSelect } from "./fps-select"

export function OutputControls({ fileName }: { fileName: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <AspectRatioPicker />
      <FpsSelect />
      <Separator orientation="vertical" className="mx-1.5 h-5!" />
      <ExportButton fileName={fileName} />
    </div>
  )
}
