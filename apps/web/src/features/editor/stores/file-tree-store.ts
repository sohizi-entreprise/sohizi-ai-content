import { create } from "zustand"
import type { ProjectResponse } from "@/features/projects/type"

type Project = Omit<ProjectResponse, "format" | "genre">

interface FileTreeState {
  projectId: string | null
  project: Project | null
  rootFolderId: string | null

  init: (projectId: string, rootFolderId: string, project: Project) => void
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  projectId: null,
  project: null,
  rootFolderId: null,

  init: (projectId, rootFolderId, project) => {
    set({
      projectId,
      rootFolderId,
      project,
    })
  },
}))
