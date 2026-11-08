import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowUpRight,
  Compass,
  FilePlus2,
  FileSpreadsheet,
  FolderOpen,
  Sparkles,
} from "lucide-react"
import useFileTreeBridge from "../../bridge/use-file-tree-bridge"
import { useEditorStore } from "../../stores/editor-store"
import { useProjectFileTree } from "../../stores/file-tree-cache"
import { useFileTreeStore } from "../../stores/file-tree-store"
import { getFileIcon } from "../../utils/get-file-icon"
import type { FileNodeType, FileTreeNode } from "../../types"
import { useFillChatInput } from "@/features/chat/hooks/use-fill-chat-input"

function collectQuickFiles(
  nodes: Array<FileTreeNode>,
  limit = 4,
): Array<FileTreeNode> {
  const files: Array<FileTreeNode> = []
  const queue = [...nodes]

  while (queue.length > 0 && files.length < limit) {
    const current = queue.shift()
    if (!current || current.id.startsWith("temp-")) continue
    if (current.directory) {
      if (current.children?.length) {
        queue.push(...current.children)
      }
      continue
    }
    files.push(current)
  }

  return files
}

export function EmptyPane() {
  const queryClient = useQueryClient()
  const projectId = useFileTreeStore((s) => s.projectId)
  const rootFolderId = useFileTreeStore((s) => s.rootFolderId)
  const projectTitle = useFileTreeStore((s) => s.project?.title)

  const openFile = useEditorStore((s) => s.openFile)
  const openFileByPath = useEditorStore((s) => s.openFileByPath)
  const sidebarCollapsed = useEditorStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar)
  const isChatOpen = useEditorStore((s) => s.chatOpenByContext["file-system"])
  const toggleChatPanel = useEditorStore((s) => s.toggleChatPanel)

  const runCommand = useFileTreeBridge((s) => s.runCommand)
  const fillChatInput = useFillChatInput()

  const treeNodes = useProjectFileTree(projectId ?? "", rootFolderId)
  const quickFiles = collectQuickFiles(treeNodes, 4)

  const handleCreateFile = (fileType: FileNodeType) => {
    if (!projectId || !rootFolderId) return
    if (sidebarCollapsed) {
      toggleSidebar()
    }
    runCommand(
      {
        type: "create",
        data: {
          projectId,
          parentId: rootFolderId,
          index: 0,
          isDir: false,
          fileType,
        },
      },
      queryClient,
    )
  }

  const handlePlanWithAi = () => {
    if (!isChatOpen) {
      toggleChatPanel("file-system")
    }
    fillChatInput({
      command: { id: "plan", display: "Plan" },
      promptPrefix: "Plan the production for",
    })
  }

  const quickActions = [
    {
      id: "brief",
      label: "Open project brief",
      hint: "/root/core/brief",
      icon: Compass,
      onClick: () => void openFileByPath("/root/core/brief"),
    },
    {
      id: "new-doc",
      label: "New document",
      hint: "Script, brief, or notes",
      icon: FilePlus2,
      onClick: () => handleCreateFile("document"),
    },
    {
      id: "new-storyboard",
      label: "New storyboard",
      hint: "Visual shot sequence",
      icon: FileSpreadsheet,
      onClick: () => handleCreateFile("storyboard"),
    },
    {
      id: "ask-koli",
      label: "Map a production plan",
      hint: "Ask Koli · /Plan",
      icon: Sparkles,
      onClick: handlePlanWithAi,
    },
  ]

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden px-6 py-8 select-none">
      {/* Ambient studio illustration backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <div className="absolute size-136 rounded-full bg-primary/4 blur-3xl" />
        <img
          src="/home-wallpaper.avif"
          alt=""
          className="h-[72%] w-[72%] max-w-3xl object-contain opacity-[0.12] transition-opacity duration-700"
          style={{
            maskImage:
              "radial-gradient(ellipse 68% 64% at 50% 50%, black 20%, rgba(0,0,0,0.45) 62%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 68% 64% at 50% 50%, black 20%, rgba(0,0,0,0.45) 62%, transparent 100%)",
          }}
        />
      </div>

      {/* Top minimal project status pill */}
      <div className="relative z-10 flex items-center gap-2 rounded-full border border-white/[0.07] bg-background/40 px-3 py-1 text-[11px] tracking-wide text-muted-foreground backdrop-blur-md">
        <span className="size-1.5 rounded-full bg-primary/80" />
        <span className="font-medium text-foreground/80 capitalize">
          {projectTitle ?? "Sohizi Studio"}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span>Workspace ready</span>
      </div>

      {/* Centerpiece identity + minimalist command list */}
      <div className="relative z-10 my-auto flex w-full max-w-md flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-3.5 text-center">
          <div className="group relative flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-background/60 shadow-xl backdrop-blur-xl">
            <div className="absolute inset-0 rounded-2xl bg-linear-to-b from-white/6 to-transparent opacity-80" />
            <img
              src="/logo-monochrome-white.svg"
              alt="Sohizi"
              className="relative size-7 object-contain opacity-85"
            />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-medium tracking-tight text-foreground">
              Where great projects are built with ease
            </h2>
            <p className="text-xs text-foreground/75">
              Pick a starting point below or open any file from the explorer.
            </p>
          </div>
        </div>

        {/* Minimalist hair-line action stack */}
        <div className="w-full divide-y divide-white/6 overflow-hidden rounded-2xl border border-white/8 bg-background/45 shadow-2xl backdrop-blur-xl">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                className="group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/4 focus-visible:bg-white/5 focus-visible:outline-none"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/3 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="truncate text-xs font-medium text-foreground/90 transition-colors group-hover:text-foreground">
                    {action.label}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
                    {action.hint}
                  </span>
                  <ArrowUpRight className="size-3.5 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground/70" />
                </div>
              </button>
            )
          })}
        </div>

        {/* Quick jump to existing project files when available */}
        {quickFiles.length > 0 && (
          <div className="flex w-full flex-col items-center gap-2">
            <span className="text-[10px] font-medium tracking-widest text-muted-foreground/50 uppercase">
              Jump to file
            </span>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {quickFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => openFile(file)}
                  className="inline-flex max-w-44 cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.07] bg-background/40 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-md transition-colors hover:border-white/15 hover:bg-white/6 hover:text-foreground"
                >
                  {getFileIcon(file.type, file.format, file.name)}
                  <span className="truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom whisper-quiet workspace bar */}
      <div className="relative z-10 flex items-center gap-3 text-[11px] text-muted-foreground/50">
        {sidebarCollapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex cursor-pointer items-center gap-1.5 transition-colors hover:text-foreground/80"
          >
            <FolderOpen className="size-3" />
            <span>Show explorer</span>
          </button>
        ) : (
          <span>Select a file in the explorer to begin editing</span>
        )}
      </div>
    </div>
  )
}
