import type { JSONContent } from '@tiptap/core'
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

// Legacy synopsis format (title + text)
export type SynopsisLegacy = {
    title: string;
    text: string;
}

// Synopsis can be either legacy format or new prose format (JSONContent)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Synopsis = SynopsisLegacy | Record<string, any> | null
export type ProseDocument = JSONContent

export type FileNode = {
    id: string;
    name: string;
    directory: boolean;
    projectId: string;
    format: string | null;
    parentId: string | null;
    position: number;
    editable: boolean;
}

export type FileNodeContent = {
    id: string;
    fileNodeId: string;
    content: string;
}

export type Outline = {
    actId: string;
    beat: {
        beatId: string;
        title: string;
        summary: string;
        goals: string[];
        turningPoints: string[];
    };
    scenes: {
        sceneId: string;
        slugline: string;
        summary: string;
    }[];
}

export type StoryBibleCharacter = {
    id: string;
    name: string;
    role: "protagonist" | "antagonist" | "supporting" | "minor";
    age: number;
    occupation: string;
    physicalDescription: string;
    personalityTraits: string[];
    backstory: string;
    motivation: string;
    flaw: string;
    voice: string;
}

export type StoryBibleLocation = {
    id: string;
    name: string;
    description: string;
    atmosphere: string;
}

export type StoryBibleProp = {
    id: string;
    name: string;
    description: string;
}

export type StoryBible = {
    timePeriod: string;
    setting: string;
    characters: StoryBibleCharacter[];
    locations: StoryBibleLocation[];
    props: StoryBibleProp[];
}

export type CreateProjectInput = {
    title: string;
    brief: ProjectBrief;
}

export type NarrativeArc = {
    title: string;
    logline: string;
    synopsis: string;
    genre: string[];
    tone: string[];
    themes: string[];
    source: "agent" | "user";
    isSelected: boolean;
}

export type ProjectResponse = {
    id: string
    title: string
    format: string
    genre: string
    createdAt: string
    updatedAt: string
}

export type ProjectListItem = {
    id: string
    title: string
    format: string
    genre: string
    durationMin: string
    status: string
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

export type ProjectStatusType = 'DRAFT' | "COMPLETED" | "EDITING"

// Entity types
export type EntityType = 'CHARACTER' | 'LOCATION' | 'PROP' | 'COSTUME'

export type BaseEntity = {
    id: string
    projectId: string
    name: string
    slug: string
    type: EntityType
    createdAt: string
    updatedAt: string
}

export type CharacterEntity = BaseEntity & {
    metadata: {
        name: string
        role: "protagonist" | "antagonist" | "supporting" | "minor";
        age: number;
        occupation: string;
        physicalDescription: string;
        personalityTraits: string[];
        backstory: string;
        motivation: string;
        flaw: string;
        voice: string;
    }
}

export type LocationEntity = BaseEntity & {
    metadata: {
        name: string;
        description: string;
    }
}

export type PropEntity = BaseEntity & {
    metadata: {
        name: string;
        description: string;
    }
}

export type CostumeEntity = BaseEntity & {
    metadata: {
        name: string;
        description: string;
    }
}

export type Entity = CharacterEntity | LocationEntity | PropEntity | CostumeEntity

export type ListEntitiesResponse = {
    items: Entity[]
    nextCursor?: string
    hasMore: boolean
}