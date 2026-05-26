import { z } from "zod"
import { UpdateProject } from "./schema"
import { PROJECT_FORMATS } from "@/lib/types"

export type UpdateProjectInput = z.infer<typeof UpdateProject>
export type ProjectFormat = (typeof PROJECT_FORMATS)[number]

export type ProjectBrief = {
    format: string;
    genre: string;
    durationMin: number;
    tone: string[];
    audience: string;
    storyIdea: string;
}

export type FileNode = {
    id: string;
    name: string;
    directory: boolean;
    projectId: string;
    format: string | null;
    parentId: string | null;
    position: number;
    editable: boolean;
    contentEditable: boolean;
}

export type FileNodeContent = {
    id: string;
    fileNodeId: string;
    content: string;
}

export type CreateProjectInput = {
    title: string;
    brief: ProjectBrief;
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
    presets: ProjectDurationPreset[]
}

export type ProjectOptions = {
    formats: ProjectFormatOption[]
    genres: ProjectGenreOption[]
    duration: ProjectDurationOption
    tones: ProjectToneOption[]
    audiences: ProjectAudienceOption[]
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

export type PublicTemplate = Template & {
    organizationId: string
    organizationName: string
}

export type PaginatedResponse<T> = {
    data: T[]
    nextCursor: string | null
    hasMore: boolean
}

