import { resolveFileByPathOrId } from "../tools/utils"
import { FileObject } from "@/features/file-system/objects/file"
import {
  getResolvedTextModel,
  type ResolvedTextModel,
} from "@/features/models/repo"
import { getSkillByName } from "@/features/file-system/repo"

export type SessionInitData = {
  sessionId: string
  userId: string
  organizationId: string
  projectId: string
  runId: string
  conversationId?: string
}

const fileEditQueue = new Map<string, Promise<void>>()

export class Session {
  public readonly id: string
  public readonly userId: string
  public readonly organizationId: string
  public readonly projectId: string
  public readonly conversationId: string | undefined
  public readonly runId: string
  // We need a cache to make sure that the read and write applies to the correct file content.
  private fileCache: Map<string, FileObject>
  private modelsCache: Map<string, ResolvedTextModel | null>
  private skillsCache: Map<string, string>

  constructor(data: SessionInitData) {
    this.id = data.sessionId
    this.userId = data.userId
    this.organizationId = data.organizationId
    this.projectId = data.projectId
    this.conversationId = data.conversationId
    this.runId = data.runId
    this.fileCache = new Map()
    this.modelsCache = new Map()
    this.skillsCache = new Map()
  }

  async resolveFileByPathOrId(
    filePathOrId: string,
  ): Promise<FileObject | null> {
    const cachedFile = this.fileCache.get(filePathOrId)
    if (cachedFile !== undefined) {
      return cachedFile
    }
    const result = await resolveFileByPathOrId(filePathOrId, this.projectId)
    if (!result.success) {
      return null
    }
    const file = this.fileCache.get(result.file.id) ?? result.file
    this.fileCache.set(filePathOrId, file)
    this.fileCache.set(file.id, file)
    this.fileCache.set(file.path, file)
    return file
  }

  async resolveModel(modelId: string): Promise<ResolvedTextModel | null> {
    const cachedModel = this.modelsCache.get(modelId)
    if (cachedModel !== undefined) {
      return cachedModel
    }
    const model = await getResolvedTextModel(modelId)
    this.modelsCache.set(modelId, model)
    return model
  }

  async resolveSkill(skillName: string): Promise<string | null> {
    const cachedSkill = this.skillsCache.get(skillName)
    if (cachedSkill !== undefined) {
      return cachedSkill
    }
    const skill = await getSkillByName(this.projectId, skillName)
    if (!skill) {
      return null
    }
    this.skillsCache.set(skillName, skill.instructions)
    return skill.instructions
  }

  async removeFileFromCache(filePathOrId: string) {
    const file = this.fileCache.get(filePathOrId)
    if (!file) return
    for (const [key, cached] of this.fileCache) {
      if (cached.id === file.id) this.fileCache.delete(key)
    }
  }

  async withFileEdit<T>(fileId: string, edit: () => Promise<T>): Promise<T> {
    const previous = fileEditQueue.get(fileId) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    fileEditQueue.set(fileId, current)

    await previous
    try {
      return await edit()
    } finally {
      release()
      if (fileEditQueue.get(fileId) === current) {
        fileEditQueue.delete(fileId)
      }
    }
  }
}
