import { MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sohizi/ui/dropdown-menu"
import type { FileNodeType } from "../../types"

export const FILE_TYPE_OPTIONS: Array<{
  label: string
  value: FileNodeType
}> = [
  { label: "Document", value: "document" },
  { label: "Skill", value: "skill" },
  { label: "Storyboard", value: "storyboard" },
  { label: "Video editor", value: "video-editor" },
]

export function fileTypeOptionsForFolder(
  folderType: string | null | undefined,
) {
  if (folderType === "skill") {
    return FILE_TYPE_OPTIONS.filter((option) => option.value === "skill")
  }
  return FILE_TYPE_OPTIONS.filter(
    (option) =>
      option.value !== "skill" && (!folderType || option.value === folderType),
  )
}

export function canCreateFileTypeInFolder(
  fileType: FileNodeType,
  folderType: string | null | undefined,
) {
  return fileTypeOptionsForFolder(folderType).some(
    (option) => option.value === fileType,
  )
}

type Props = {
  onChange: (action: string) => void
  options: Array<{
    icon: React.ReactNode
    label: string
    value: string
  }>
  children?: React.ReactNode
}

export const FileNodeMenu = (props: Props) => {
  const { onChange, options, children } = props
  const handleClick = (action: string) => {
    return (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation()
      onChange(action)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        {children ? (
          children
        ) : (
          <button
            type="button"
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-accent/50"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="bottom"
        className="min-w-[160px]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={handleClick(option.value)}
          >
            {option.icon ?? null}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
