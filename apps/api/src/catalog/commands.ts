import { join } from "node:path"
import { z } from "zod"

export type CatalogCommand = {
  id: string
  name: string
  promptModifier: string
}

export type PublicCommand = Omit<CatalogCommand, "promptModifier">

const commandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  promptModifier: z.string().min(1),
})

const commandsFileSchema = z.object({
  commands: z.array(commandSchema).min(1),
})

const COMMANDS_FILE = join(import.meta.dir, "commands.yaml")

let cachedCommands: CatalogCommand[] | null = null
let loadingCommands: Promise<CatalogCommand[]> | null = null

export const loadCommands = async (
  commandsFile = COMMANDS_FILE,
): Promise<CatalogCommand[]> => {
  const source = "commands.yaml"
  let parsed: unknown
  try {
    parsed = Bun.YAML.parse(await Bun.file(commandsFile).text())
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${source}: ${message}`)
  }

  const result = commandsFileSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`${source}: ${result.error.message}`)
  }

  const seenIds = new Set<string>()
  for (const command of result.data.commands) {
    if (seenIds.has(command.id)) {
      throw new Error(`${source}: duplicate command id "${command.id}"`)
    }
    seenIds.add(command.id)
  }

  return result.data.commands
}

export const resetCommandCache = () => {
  cachedCommands = null
  loadingCommands = null
}

export const getCommands = async (): Promise<CatalogCommand[]> => {
  if (cachedCommands) {
    return cachedCommands
  }
  if (!loadingCommands) {
    loadingCommands = loadCommands()
      .then((commands) => {
        cachedCommands = commands
        return commands
      })
      .finally(() => {
        loadingCommands = null
      })
  }
  return loadingCommands
}

export const toPublicCommands = (commands: CatalogCommand[]): PublicCommand[] =>
  commands.map((command) => ({
    id: command.id,
    name: command.name,
  }))

export const resolveCatalogCommands = (
  commands: CatalogCommand[],
  commandIds: string[] | undefined,
): CatalogCommand[] => {
  if (!commandIds || commandIds.length === 0) {
    return []
  }
  const byKey = new Map<string, CatalogCommand>()
  for (const command of commands) {
    byKey.set(command.id.toLowerCase(), command)
    byKey.set(command.name.toLowerCase(), command)
  }

  const resolved: CatalogCommand[] = []
  const seen = new Set<string>()
  for (const raw of commandIds) {
    const key = raw.trim().toLowerCase()
    if (!key) continue
    const match = byKey.get(key)
    if (match && !seen.has(match.id)) {
      seen.add(match.id)
      resolved.push(match)
    }
  }
  return resolved
}
