import { z } from "zod"
import { CreateProject, UpdateProject } from "./schema"
import { PROJECT_FORMATS } from "@/lib/types"

export type CreateProjectInput = z.infer<typeof CreateProject>
export type UpdateProjectInput = z.infer<typeof UpdateProject>
export type ProjectFormat = (typeof PROJECT_FORMATS)[number]

export type ProjectResponse = {
    id: string
    createdAt: string
    updatedAt: string
} & CreateProjectInput

export type ProjectListItem = {
    id: string
    name: string
    format: string
    genre: string
    createdAt: string
    shotCount: number
}


export type ProjectStatusType = 'DRAFTING' | "COMPLETED" | "EDITING"