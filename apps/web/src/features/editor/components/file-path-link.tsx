import { useEditorStore } from "../stores/editor-store"
import type { AnchorHTMLAttributes, MouseEvent } from "react"
import { toProjectFilePath } from "@/lib/file-tag"
import { cn } from "@/lib/utils"

export function FilePathLink({
  href,
  onClick,
  children,
  node: _node,
  target,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) {
  const path = toProjectFilePath(href)

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (path) {
      event.preventDefault()
      event.stopPropagation()
      void useEditorStore.getState().openFileByPath(path)
      return
    }
    onClick?.(event)
  }

  return (
    <a
      {...props}
      className={cn(props.className, path && "file-tag-link")}
      href={href}
      target={path ? undefined : target}
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
