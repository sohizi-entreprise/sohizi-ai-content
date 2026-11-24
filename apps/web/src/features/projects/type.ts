export type ProjectBrief = {
  format: string
  genre: string
  durationMin: number
  tone: Array<string>
  audience: string
  storyIdea: string
}

export type FileNode = {
  id: string
  name: string
  directory: boolean
  projectId: string
  type: string | null
  format: string | null
  parentId: string | null
  position: number
  editable: boolean
  contentEditable: boolean
  path: string
}

export type DirectoryChild = FileNode & {
  previewUrl: string | null
}

export type DirectoryChildrenPage = {
  data: Array<DirectoryChild>
  nextCursor: string | null
  hasMore: boolean
}

/** File node from the assets-folder listing, with media URL joined in. */
export type ProjectAssetFile = FileNode & {
  url: string | null
  source: string | null
}

export type FileNodeContent = {
  id: string
  fileNodeId: string
  content: string
}

export type CreateProjectInput = {
  title: string
  brief: ProjectBrief
}

export type ProjectResponse = {
  id: string
  title: string
  isTemplate: boolean
  fromTemplateId: string | null
  createdAt: string
  updatedAt: string
}

export type ProjectListItem = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type ProjectGenerationTarget = "image" | "video" | "audio" | "project"

export type ProjectPresetIllustration = {
  url: string | null
  type: "video" | "image"
}

export type ProjectPresetOption = {
  label: string
  value: string
  illustration: ProjectPresetIllustration
}

export type ProjectPreset = {
  id: string
  key: string
  label: string
  generationTarget: ProjectGenerationTarget
  options: Array<ProjectPresetOption>
}

export type ProjectCommand = {
  id: string
  name: string
}

export type ProjectOptions = {
  presets: Array<ProjectPreset>
  commands: Array<ProjectCommand>
}

export type Template = {
  id: string
  projectId: string
  name: string
  slug: string
  description: string | null
  thumbnail: string | null
  status: string
  visibility: string
  displayPriority: number
  createdAt: string
  updatedAt: string
}

export type CreateTemplateInput = {
  name: string
}

export type CreateTemplateResponse = {
  project: ProjectResponse
  template: Template
}

export type ModelPreferenceKey =
  | "leading-agent"
  | "text-to-image"
  | "image-to-image"
  | "text-to-video"
  | "image-to-video"
  | "text-to-speech"
  | "music-generation"

export type ModelPreferenceType = "system_default" | "project"

export type ModelPreferenceParameters = Record<string, string | number>

export type ModelPreferenceCostParameter = {
  key: string
  label: string
  defaultValue: string | null
  options: Array<{ value: string; label: string }>
}

export type ModelPreferenceEstimate =
  | {
      kind: "fixed"
      credits: number
      unitLabel: string
    }
  | {
      kind: "range"
      minCredits: number
      maxCredits: number
      unitLabel: string
    }

export type ModelPreferenceModelOption = {
  id: string
  name: string
  provider: string
}

export type ProjectModelPreference = {
  key: ModelPreferenceKey
  label: string
  description: string
  category: ModelPreferenceKey
  type: ModelPreferenceType
  modelId: string
  parameters: ModelPreferenceParameters
  costParameters: Array<ModelPreferenceCostParameter>
  estimate: ModelPreferenceEstimate | null
  models: Array<ModelPreferenceModelOption>
}

export type ModelPreferenceEstimateResponse = {
  key: ModelPreferenceKey
  modelId: string
  parameters: ModelPreferenceParameters
  costParameters: Array<ModelPreferenceCostParameter>
  estimate: ModelPreferenceEstimate | null
}

export type { PaginatedResponse } from "@/lib/pagination"
