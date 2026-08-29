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
  format: string | null
  parentId: string | null
  position: number
  editable: boolean
  contentEditable: boolean
}

/** File node from the assets-folder listing, with media URL joined in. */
export type ProjectAssetFile = FileNode & {
  url: string | null
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

export type ProjectFormatOption = {
  id: string
  name: string
  description: string
}

export type ProjectGenreOption = {
  id: string
  name: string
  description: string
  image: string
}

export type ProjectToneOption = {
  id: string
  name: string
  description: string
}

export type ProjectAudienceOption = {
  id: string
  name: string
  description: string
  ageRange: string
}

export type ProjectDurationPreset = {
  id: string
  name: string
  minutes: number
  description: string
}

export type ProjectDurationOption = {
  min: number
  max: number
  presets: Array<ProjectDurationPreset>
}

export type ProjectOptions = {
  formats: Array<ProjectFormatOption>
  genres: Array<ProjectGenreOption>
  duration: ProjectDurationOption
  tones: Array<ProjectToneOption>
  audiences: Array<ProjectAudienceOption>
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

export type { PaginatedResponse } from '@/lib/pagination'
