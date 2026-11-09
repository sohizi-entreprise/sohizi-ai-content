/**
 * Parsing/serialization helpers for the storyboard world-bible front matter
 * and the `:::scene` / `:::shot` container markdown syntax.
 *
 * Example:
 *   ---
 *   aspectRatio: "16:9"
 *   visualStyle: "Gritty neo-noir, practical light, wet streets."
 *   colorPalette:
 *     - "#1a1a1a"
 *     - "#c4a574"
 *   temporalContext: "Present day, late autumn"
 *   ---
 *
 *   :::scene
 *   id: scene-1
 *   title: Arrival
 *   action: A detective enters an abandoned warehouse.
 *   environment: Abandoned warehouse on the docks, night.
 *   lighting: One practical bulb overhead, hard shadows.
 *
 *   :::shot
 *   id: shot-1
 *   number: 1
 *   image: /images/shot-1.jpg
 *   action: Wide establishing shot of the warehouse.
 *   composition: Warehouse occupies upper two-thirds; dock pilings in foreground.
 *   duration: 3s
 *   purpose: Establish scale and isolation before entry.
 *   transition: Cut on door movement
 *   camera:
 *     angle: low angle
 *     movement: slow push in
 *   :::
 *   :::
 */

export const STORYBOARD_ASPECT_RATIOS = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "4:5",
  "21:9",
  "2.39:1",
] as const

export type StoryboardAspectRatio = (typeof STORYBOARD_ASPECT_RATIOS)[number]

export const STORYBOARD_SHOT_TYPES = [
  "Extreme Close-Up",
  "Close-Up",
  "Medium Close-Up",
  "Medium Shot",
  "Medium Long Shot",
  "Long Shot",
  "Wide Shot",
  "Extreme Wide Shot",
] as const

export type StoryboardShotType = (typeof STORYBOARD_SHOT_TYPES)[number]

const SHOT_TYPE_ABBREVIATIONS: Record<string, StoryboardShotType> = {
  ecu: "Extreme Close-Up",
  cu: "Close-Up",
  mcu: "Medium Close-Up",
  ms: "Medium Shot",
  mls: "Medium Long Shot",
  ls: "Long Shot",
  ws: "Wide Shot",
  ews: "Extreme Wide Shot",
}

export function parseShotType(value: string): StoryboardShotType | "" {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const match = STORYBOARD_SHOT_TYPES.find(
    (type) => type.toLowerCase() === trimmed.toLowerCase(),
  )
  if (match) return match
  return SHOT_TYPE_ABBREVIATIONS[trimmed.toLowerCase()] ?? ""
}

export type ShotDialogueLine = {
  speaker: string
  text: string
}

export type ShotCamera = {
  angle?: string
  movement?: string
}

export type ShotData = {
  id: string
  number?: number
  shotType?: StoryboardShotType
  image?: string
  action?: string
  composition?: string
  duration?: string
  purpose?: string
  transition?: string
  dialogue?: Array<ShotDialogueLine>
  narration?: string
  camera?: ShotCamera
}

export type SceneData = {
  id: string
  title: string
  action: string
  environment: string
  lighting: string
  shots: Array<ShotData>
}

export type StoryboardSettings = {
  aspectRatio: StoryboardAspectRatio
  visualStyle: string
  colorPalette: Array<string>
  temporalContext: string
}

export const DEFAULT_STORYBOARD_SETTINGS: StoryboardSettings = {
  aspectRatio: "16:9",
  visualStyle: "",
  colorPalette: [],
  temporalContext: "",
}

const FENCE_OPEN_REGEX = /^:::\S/
const KEY_VALUE_REGEX = /^([a-zA-Z_]+):[ \t]?(.*)$/
const FRONT_MATTER_OPEN_REGEX = /^---[ \t]*$/

let idCounter = 0

/** Generate a reasonably unique id for a scene/shot. */
export function generateStoryboardId(prefix: "scene" | "shot"): string {
  idCounter += 1
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${random}-${idCounter}`
}

export function parseAspectRatio(value: string): StoryboardAspectRatio {
  return (STORYBOARD_ASPECT_RATIOS as ReadonlyArray<string>).includes(value)
    ? (value as StoryboardAspectRatio)
    : DEFAULT_STORYBOARD_SETTINGS.aspectRatio
}

export function aspectRatioToCss(ratio: StoryboardAspectRatio): string {
  const [width, height] = ratio.split(":")
  return `${width} / ${height}`
}

export function aspectRatioToDimensions(
  ratio: StoryboardAspectRatio,
  longSide = 1920,
): { width: number; height: number } {
  const [width, height] = ratio.split(":").map(Number)
  if (width >= height) {
    return {
      width: longSide,
      height: Math.max(1, Math.round(longSide * (height / width))),
    }
  }
  return {
    width: Math.max(1, Math.round(longSide * (width / height))),
    height: longSide,
  }
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function unquoteYaml(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const quote = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if (quote === last && (quote === '"' || quote === "'")) {
      const inner = trimmed.slice(1, -1)
      if (quote === '"') {
        return inner
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
      }
      return inner.replace(/\\'/g, "'")
    }
  }
  return trimmed
}

function normalizeHex(value: string): string | null {
  const match = value.trim().match(/^#?([0-9a-fA-F]{6})$/)
  if (!match) return null
  return `#${match[1].toLowerCase()}`
}

/**
 * Given source text that starts at a `---` line, return the raw front-matter
 * block, or `undefined` when no matching closing `---` is found.
 */
export function matchFrontMatterBlock(src: string): string | undefined {
  const lines = src.replace(/\r\n/g, "\n").split("\n")
  if (!FRONT_MATTER_OPEN_REGEX.test(lines[0] ?? "")) return undefined

  for (let index = 1; index < lines.length; index += 1) {
    if (FRONT_MATTER_OPEN_REGEX.test(lines[index])) {
      return lines.slice(0, index + 1).join("\n")
    }
  }

  return undefined
}

export function parseFrontMatter(raw: string): StoryboardSettings {
  const lines = raw.replace(/\r\n/g, "\n").split("\n")
  const body = lines.slice(1, Math.max(1, lines.length - 1))
  const settings: StoryboardSettings = {
    ...DEFAULT_STORYBOARD_SETTINGS,
    colorPalette: [],
  }

  let index = 0
  while (index < body.length) {
    const line = body[index]

    if (/^[ \t]*colorPalette:[ \t]*$/.test(line)) {
      index += 1
      const colors: Array<string> = []
      while (index < body.length && /^[ \t]*-[ \t]/.test(body[index])) {
        const value = unquoteYaml(body[index].replace(/^[ \t]*-[ \t]?/, ""))
        if (value) colors.push(normalizeHex(value) ?? value)
        index += 1
      }
      settings.colorPalette = colors
      continue
    }

    const match = line.match(KEY_VALUE_REGEX)
    if (match) {
      const [, key, rawValue] = match
      const value = unquoteYaml(rawValue)
      switch (key) {
        case "aspectRatio":
          settings.aspectRatio = parseAspectRatio(value)
          break
        case "visualStyle":
          settings.visualStyle = oneLine(value)
          break
        case "temporalContext":
          settings.temporalContext = oneLine(value)
          break
        default:
          break
      }
    }
    index += 1
  }

  return settings
}

export function serializeFrontMatter(settings: StoryboardSettings): string {
  const lines = [
    "---",
    `aspectRatio: ${quoteYaml(parseAspectRatio(settings.aspectRatio))}`,
    `visualStyle: ${quoteYaml(oneLine(settings.visualStyle))}`,
    "colorPalette:",
  ]
  for (const color of settings.colorPalette) {
    const normalized = normalizeHex(color) ?? color.trim()
    if (!normalized) continue
    lines.push(`  - ${quoteYaml(normalized)}`)
  }
  lines.push(
    `temporalContext: ${quoteYaml(oneLine(settings.temporalContext))}`,
    "---",
  )
  return lines.join("\n")
}

/** Prepend default front matter when the markdown has none. */
export function ensureStoryboardFrontMatter(markdown: string): string {
  const text = markdown.replace(/^\uFEFF/, "")
  const trimmedStart = text.replace(/^\s+/, "")
  if (matchFrontMatterBlock(trimmedStart)) return trimmedStart
  const body = text.trim()
  const front = serializeFrontMatter(DEFAULT_STORYBOARD_SETTINGS)
  return body ? `${front}\n\n${body}` : front
}

/**
 * Given source text that starts at a `:::scene` line, return the raw text of
 * the whole (nesting-aware) scene block, or `undefined` when no matching
 * closing `:::` is found.
 */
export function matchSceneBlock(src: string): string | undefined {
  if (!/^:::scene[ \t]*(\n|$)/.test(src)) return undefined

  const lines = src.split("\n")
  let depth = 0

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim()
    if (FENCE_OPEN_REGEX.test(trimmed)) {
      depth += 1
    } else if (trimmed === ":::") {
      depth -= 1
      if (depth === 0) {
        return lines.slice(0, i + 1).join("\n")
      }
    }
  }

  return undefined
}

/** Parse a full `:::scene ... :::` block (raw text) into structured data. */
export function parseSceneBlock(raw: string): SceneData {
  const lines = raw.split("\n")
  // Drop the opening `:::scene` and the final closing `:::`.
  const body = lines.slice(1, lines.length - 1)

  const meta: Partial<Record<string, string>> = {}
  let index = 0

  while (index < body.length && !FENCE_OPEN_REGEX.test(body[index].trim())) {
    const match = body[index].match(KEY_VALUE_REGEX)
    if (match) meta[match[1]] = match[2]
    index += 1
  }

  const shots: Array<ShotData> = []

  while (index < body.length) {
    if (/^:::shot/.test(body[index].trim())) {
      index += 1 // consume `:::shot`
      const shotLines: Array<string> = []
      while (index < body.length) {
        if (body[index].trim() === ":::") {
          index += 1 // consume closing `:::`
          break
        }
        shotLines.push(body[index])
        index += 1
      }
      shots.push(parseShotLines(shotLines))
    } else {
      index += 1
    }
  }

  return {
    id: meta.id || generateStoryboardId("scene"),
    title: meta.title ?? "",
    action: meta.action ?? meta.description ?? "",
    environment: meta.environment ?? "",
    lighting: meta.lighting ?? "",
    shots,
  }
}

function parseShotLines(lines: Array<string>): ShotData {
  const shot: ShotData = { id: "" }
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (/^[ \t]*dialogue:[ \t]*$/.test(line)) {
      index += 1
      const dialogue: Array<ShotDialogueLine> = []
      while (
        index < lines.length &&
        /^[ \t]*-[ \t]*speaker:/.test(lines[index])
      ) {
        const speaker = lines[index]
          .replace(/^[ \t]*-[ \t]*speaker:[ \t]?/, "")
          .trim()
        index += 1
        let text = ""
        if (index < lines.length && /^[ \t]*text:/.test(lines[index])) {
          text = lines[index].replace(/^[ \t]*text:[ \t]?/, "")
          index += 1
        }
        dialogue.push({ speaker, text })
      }
      if (dialogue.length > 0) shot.dialogue = dialogue
      continue
    }

    if (/^[ \t]*camera:[ \t]*$/.test(line)) {
      index += 1
      const camera: ShotCamera = {}
      while (
        index < lines.length &&
        /^[ \t]+(angle|movement):/.test(lines[index])
      ) {
        const cameraMatch = lines[index].match(
          /^[ \t]+(angle|movement):[ \t]?(.*)$/,
        )
        if (cameraMatch) {
          const value = cameraMatch[2]
          if (cameraMatch[1] === "angle") camera.angle = value
          if (cameraMatch[1] === "movement") camera.movement = value
        }
        index += 1
      }
      if (camera.angle || camera.movement) shot.camera = camera
      continue
    }

    const match = line.match(KEY_VALUE_REGEX)
    if (match) {
      const [, key, value] = match
      switch (key) {
        case "id":
          shot.id = value
          break
        case "number": {
          const trimmed = value.trim()
          if (!trimmed) break
          const parsed = Number(trimmed)
          if (!Number.isNaN(parsed)) shot.number = parsed
          break
        }
        case "image":
          shot.image = value
          break
        case "shotType": {
          const parsedShotType = parseShotType(unquoteYaml(value))
          if (parsedShotType) shot.shotType = parsedShotType
          break
        }
        case "action":
          shot.action = value
          break
        case "composition":
          if (value) shot.composition = value
          break
        case "duration":
          if (value) shot.duration = value
          break
        case "purpose":
          if (value) shot.purpose = value
          break
        case "transition":
          if (value) shot.transition = value
          break
        case "narration":
          shot.narration = value
          break
        default:
          break
      }
    }
    index += 1
  }

  if (!shot.id) shot.id = generateStoryboardId("shot")
  return shot
}

/** Serialize a single shot into its `:::shot ... :::` block. */
export function serializeShot(shot: ShotData): string {
  const lines: Array<string> = [":::shot"]
  lines.push(`id: ${shot.id}`)
  lines.push(`number: ${shot.number ?? ""}`)
  if (shot.shotType) lines.push(`shotType: ${shot.shotType}`)
  if (shot.image) lines.push(`image: ${shot.image}`)
  lines.push(`action: ${shot.action ?? ""}`)
  if (shot.composition) lines.push(`composition: ${shot.composition}`)
  if (shot.duration) lines.push(`duration: ${shot.duration}`)
  if (shot.purpose) lines.push(`purpose: ${shot.purpose}`)
  if (shot.transition) lines.push(`transition: ${shot.transition}`)
  if (shot.dialogue && shot.dialogue.length > 0) {
    lines.push("dialogue:")
    for (const line of shot.dialogue) {
      lines.push(`  - speaker: ${line.speaker}`)
      lines.push(`    text: ${line.text}`)
    }
  }
  if (shot.narration) lines.push(`narration: ${shot.narration}`)
  if (shot.camera && (shot.camera.angle || shot.camera.movement)) {
    lines.push("camera:")
    if (shot.camera.angle) lines.push(`  angle: ${shot.camera.angle}`)
    if (shot.camera.movement) lines.push(`  movement: ${shot.camera.movement}`)
  }
  lines.push(":::")
  return lines.join("\n")
}

/** Serialize a scene into its `:::scene ... :::` block. */
export function serializeScene(scene: SceneData): string {
  const lines: Array<string> = [":::scene"]
  lines.push(`id: ${scene.id}`)
  lines.push(`title: ${scene.title}`)
  lines.push(`action: ${scene.action}`)
  lines.push(`environment: ${scene.environment}`)
  lines.push(`lighting: ${scene.lighting}`)
  lines.push("")
  for (const shot of scene.shots) {
    lines.push(serializeShot(shot))
    lines.push("")
  }
  lines.push(":::")
  return lines.join("\n")
}
