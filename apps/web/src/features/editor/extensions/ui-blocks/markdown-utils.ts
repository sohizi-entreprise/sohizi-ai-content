export type MediaBlockType = "image" | "video" | "audio"

export const MEDIA_BLOCK_TYPES: ReadonlyArray<MediaBlockType> = [
  "image",
  "video",
  "audio",
]

export type ImageFitMode = "cover" | "contain"

export const IMAGE_FIT_MODES: ReadonlyArray<ImageFitMode> = ["cover", "contain"]

export function normalizeImageFit(value: unknown): ImageFitMode {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === "contain" || trimmed === "contains") return "contain"
  }
  return "cover"
}

export interface MediaBlockData {
  type: MediaBlockType
  url: string
  alt: string
  fit?: ImageFitMode
}

export interface SourceItem {
  title: string
  url: string
  description: string
}

export interface SourcesBlockData {
  title: string
  items: Array<SourceItem>
}

export interface PaletteSwatch {
  color: string
  label: string
}

export interface CardBlockHeader {
  title: string
  subtitle: string
  badge: string
  image: string
}

export type MoodboardColumns = 2 | 3

export const MOODBOARD_COLUMN_OPTIONS: ReadonlyArray<MoodboardColumns> = [2, 3]

export interface MoodboardItem {
  url: string
  caption: string
}

export interface MoodboardBlockData {
  title: string
  columns?: MoodboardColumns
  fit?: ImageFitMode
  items: Array<MoodboardItem>
}

export interface TimelineBeatItem {
  duration: string
  label: string
  scene: string
}

export interface TimelineBlockData {
  title: string
  items: Array<TimelineBeatItem>
}

export type InlineBadgeColor = "highlight" | "warning" | "danger" | "neutral"

export const INLINE_BADGE_COLORS: ReadonlyArray<InlineBadgeColor> = [
  "highlight",
  "warning",
  "danger",
  "neutral",
]

export type PropertiesLayout = "grid" | "list" | "inline"

export const PROPERTIES_LAYOUTS: ReadonlyArray<PropertiesLayout> = [
  "grid",
  "list",
  "inline",
]

export interface PropertyItem {
  key: string
  value: string
}

export interface PropertiesBlockData {
  title: string
  layout: PropertiesLayout
  items: Array<PropertyItem>
}

export interface AttributeItem {
  label: string
  value: string
}

export interface AttributesBlockData {
  title: string
  items: Array<AttributeItem>
}

export interface TreeItem {
  label: string
  description: string
  depth: number
  /** Presentation-only: descendants stay in markdown when true. */
  collapsed: boolean
}

export interface TreeBlockData {
  title: string
  items: Array<TreeItem>
}

export type TextAlignFence = "center" | "right"

export const TEXT_ALIGN_FENCES: ReadonlyArray<TextAlignFence> = [
  "center",
  "right",
]

const FENCE_OPEN_ANY_REGEX = /^:::[a-zA-Z0-9_-]+[ \t]*$/
const FENCE_CLOSE_REGEX = /^:::[ \t]*$/
const KEY_VALUE_REGEX = /^([a-zA-Z][a-zA-Z0-9_-]*):[ \t]*(.*)$/

/**
 * Find the earliest index of a `:::<tag>` fence at the start of a line.
 */
export function findContainerBlockStart(src: string, tag: string): number {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(?:^|\\n):::${escaped}[ \\t]*(?=\\r?\\n|$)`)
  const match = regex.exec(src)
  if (!match) return -1
  return match[0].startsWith("\n") ? match.index + 1 : match.index
}

/**
 * Find the earliest index of a `:::center` or `:::right` fence at the start of a line.
 */
export function findAlignBlockStart(src: string): number {
  let earliest = -1
  for (const align of TEXT_ALIGN_FENCES) {
    const idx = findContainerBlockStart(src, align)
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx
    }
  }
  return earliest
}

/**
 * Match a complete `:::center ... :::` or `:::right ... :::` block starting at index 0 of `src`.
 */
export function matchAlignBlock(
  src: string,
): { align: TextAlignFence; raw: string; bodyMarkdown: string } | undefined {
  for (const align of TEXT_ALIGN_FENCES) {
    const raw = matchContainerBlock(src, align)
    if (raw) {
      const bodyMarkdown = extractContainerBodyLines(raw).join("\n").trim()
      return { align, raw, bodyMarkdown }
    }
  }
  return undefined
}

/**
 * Coalesce consecutive `:::center ... :::` or `:::right ... :::` blocks of the
 * same alignment separated by a single blank line into one multi-block fence.
 */
export function coalesceAlignedFences(markdown: string): string {
  if (!markdown) return ""
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  const out: Array<string> = []

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i]?.trim()
    const next = lines[i + 1]?.trim()
    const afterNext = lines[i + 2]?.trim()

    if (
      current === ":::" &&
      next === "" &&
      (afterNext === ":::center" || afterNext === ":::right")
    ) {
      let openAlign: string | null = null
      let depth = 0
      for (let j = out.length - 1; j >= 0; j -= 1) {
        const line = out[j]?.trim() ?? ""
        if (FENCE_CLOSE_REGEX.test(line)) {
          depth += 1
        } else if (FENCE_OPEN_ANY_REGEX.test(line)) {
          if (depth === 0) {
            openAlign = line
            break
          }
          depth -= 1
        }
      }

      if (openAlign === afterNext) {
        out.push("")
        i += 2
        continue
      }
    }

    out.push(lines[i])
  }

  return out.join("\n")
}

/**
 * Match a complete `:::<tag> ... :::` block starting at index 0 of `src`.
 * Nesting-aware so inner `:::` blocks do not prematurely close an outer block.
 */
export function matchContainerBlock(
  src: string,
  tag: string,
): string | undefined {
  const normalized = src.replace(/\r\n/g, "\n")
  const openRegex = new RegExp(`^:::${tag}[ \\t]*(\\n|$)`)
  if (!openRegex.test(normalized)) return undefined

  const lines = normalized.split("\n")
  let depth = 0

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (FENCE_OPEN_ANY_REGEX.test(line)) {
      depth += 1
    } else if (FENCE_CLOSE_REGEX.test(line)) {
      depth -= 1
      if (depth === 0) {
        return lines.slice(0, i + 1).join("\n")
      }
    }
  }

  return undefined
}

/**
 * Extract the inner lines between the opening `:::<tag>` and closing `:::`.
 */
export function extractContainerBodyLines(raw: string): Array<string> {
  const lines = raw.replace(/\r\n/g, "\n").split("\n")
  if (lines.length < 2) return []
  return lines.slice(1, lines.length - 1)
}

/**
 * Split leading `key: value` header lines from the rest of a container block.
 */
export function splitHeaderAndBody(
  lines: ReadonlyArray<string>,
  allowedKeys?: ReadonlySet<string>,
): {
  header: Record<string, string>
  bodyLines: Array<string>
} {
  const header: Record<string, string> = {}
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed) {
      index += 1
      break
    }

    const match = line.match(KEY_VALUE_REGEX)
    if (!match) {
      break
    }

    const [, key, rawValue] = match
    if (allowedKeys && !allowedKeys.has(key)) {
      break
    }

    header[key] = rawValue.trim()
    index += 1
  }

  while (index < lines.length && lines[index].trim() === "") {
    index += 1
  }

  return {
    header,
    bodyLines: lines.slice(index),
  }
}

function cleanSingleLine(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.replace(/[\r\n]+/g, " ").trim()
}

function preserveSpacesSingleLine(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.replace(/[\r\n]+/g, " ")
}

// ---- 1. Media (`:::media`) -------------------------------------------------

export function normalizeMediaType(value: unknown): MediaBlockType {
  if (
    typeof value === "string" &&
    (MEDIA_BLOCK_TYPES as ReadonlyArray<string>).includes(value.trim())
  ) {
    return value.trim() as MediaBlockType
  }
  return "image"
}

const MEDIA_KEYS = new Set(["type", "url", "alt", "fit"])

export function parseMediaBlock(raw: string): MediaBlockData {
  const lines = extractContainerBodyLines(raw)
  const { header } = splitHeaderAndBody(lines, MEDIA_KEYS)
  return {
    type: normalizeMediaType(header.type),
    url: cleanSingleLine(header.url),
    alt: cleanSingleLine(header.alt),
    fit: normalizeImageFit(header.fit),
  }
}

export function serializeMediaBlock(data: MediaBlockData): string {
  const type = normalizeMediaType(data.type)
  const url = cleanSingleLine(data.url)
  const alt = cleanSingleLine(data.alt)
  const fit = normalizeImageFit(data.fit)

  const lines = [":::media", `type: ${type}`, `url: ${url}`]
  if (alt) {
    lines.push(`alt: ${alt}`)
  }
  if (fit === "contain") {
    lines.push("fit: contain")
  }
  lines.push(":::")
  return lines.join("\n")
}

// ---- 2. Sources (`:::sources`) ---------------------------------------------

const SOURCES_KEYS = new Set(["title"])
const MARKDOWN_LINK_ITEM_REGEX =
  /^-[ \t]+\[([^\]]*)\]\(([^)]+)\)(?:[ \t]*\|[ \t]*(.*))?$/
const BARE_URL_ITEM_REGEX = /^-[ \t]+(\S+)(?:[ \t]*\|[ \t]*(.*))?$/
const PIPE_CONTINUATION_REGEX = /^[ \t]*\|[ \t]*(.*)$/

export function parseSourcesBlockWithMeta(raw: string): SourcesBlockData {
  const allLines = extractContainerBodyLines(raw)
  const { header, bodyLines } = splitHeaderAndBody(allLines, SOURCES_KEYS)
  const lines = bodyLines
  const items: Array<SourceItem> = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const linkMatch = trimmed.match(MARKDOWN_LINK_ITEM_REGEX)
    if (linkMatch) {
      const title = cleanSingleLine(linkMatch[1])
      const url = cleanSingleLine(linkMatch[2])
      let description = cleanSingleLine(linkMatch[3])

      if (!description && index + 1 < lines.length) {
        const nextMatch = lines[index + 1].match(PIPE_CONTINUATION_REGEX)
        if (nextMatch) {
          description = cleanSingleLine(nextMatch[1])
          index += 1
        }
      }

      items.push({ title: title || url, url, description })
      index += 1
      continue
    }

    const bareMatch = trimmed.match(BARE_URL_ITEM_REGEX)
    if (bareMatch) {
      const url = cleanSingleLine(bareMatch[1])
      let description = cleanSingleLine(bareMatch[2])

      if (!description && index + 1 < lines.length) {
        const nextMatch = lines[index + 1].match(PIPE_CONTINUATION_REGEX)
        if (nextMatch) {
          description = cleanSingleLine(nextMatch[1])
          index += 1
        }
      }

      items.push({ title: url, url, description })
      index += 1
      continue
    }

    index += 1
  }

  return {
    title: cleanSingleLine(header.title),
    items,
  }
}

export function parseSourcesBlock(raw: string): Array<SourceItem> {
  return parseSourcesBlockWithMeta(raw).items
}

export function normalizeSourceItems(value: unknown): Array<SourceItem> {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      return {
        title: preserveSpacesSingleLine(record.title),
        url: preserveSpacesSingleLine(record.url),
        description: preserveSpacesSingleLine(record.description),
      }
    })
    .filter((entry): entry is SourceItem => entry !== null)
}

export function serializeSourcesBlock(
  itemsOrData: ReadonlyArray<SourceItem> | SourcesBlockData,
): string {
  const isDataObj = !Array.isArray(itemsOrData)
  const title = isDataObj
    ? cleanSingleLine((itemsOrData as SourcesBlockData).title)
    : ""
  const items = isDataObj
    ? (itemsOrData as SourcesBlockData).items
    : (itemsOrData as ReadonlyArray<SourceItem>)

  const blocks = items.map((item) => {
    const itemTitle = cleanSingleLine(item.title) || cleanSingleLine(item.url)
    const url = cleanSingleLine(item.url)
    const description = cleanSingleLine(item.description)
    if (description) {
      return `- [${itemTitle}](${url})\n  | ${description}`
    }
    return `- [${itemTitle}](${url})`
  })

  const lines = [":::sources"]
  if (title) {
    lines.push(`title: ${title}`)
  }
  if (blocks.length > 0) {
    if (title) {
      lines.push("")
    }
    lines.push(blocks.join("\n\n"))
  }
  lines.push(":::")
  return lines.join("\n")
}

// ---- 3. Palette (`:::palette`) ---------------------------------------------

const PALETTE_LINE_REGEX = /^-[ \t]+([^|]+?)(?:[ \t]*\|[ \t]*(.*))?$/

export function parsePaletteBlock(raw: string): Array<PaletteSwatch> {
  const lines = extractContainerBodyLines(raw)
  const swatches: Array<PaletteSwatch> = []

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue
    const match = trimmed.match(PALETTE_LINE_REGEX)
    if (!match) continue
    const color = cleanSingleLine(match[1])
    const label = cleanSingleLine(match[2])
    if (!color) continue
    swatches.push({ color, label })
  }

  return swatches
}

export function normalizePaletteSwatches(value: unknown): Array<PaletteSwatch> {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      const color = cleanSingleLine(record.color)
      const label = preserveSpacesSingleLine(record.label)
      return { color: color || "#000000", label }
    })
    .filter((entry): entry is PaletteSwatch => entry !== null)
}

export function serializePaletteBlock(
  swatches: ReadonlyArray<PaletteSwatch>,
): string {
  const lines = [":::palette"]
  for (const swatch of swatches) {
    const color = cleanSingleLine(swatch.color) || "#000000"
    const label = cleanSingleLine(swatch.label)
    lines.push(label ? `- ${color} | ${label}` : `- ${color}`)
  }
  lines.push(":::")
  return lines.join("\n")
}

// ---- 4. Card (`:::card`) ---------------------------------------------------

const CARD_KEYS = new Set(["title", "subtitle", "badge", "image"])

export function parseCardBlock(raw: string): {
  header: CardBlockHeader
  bodyMarkdown: string
} {
  const lines = extractContainerBodyLines(raw)
  const { header, bodyLines } = splitHeaderAndBody(lines, CARD_KEYS)
  return {
    header: {
      title: cleanSingleLine(header.title),
      subtitle: cleanSingleLine(header.subtitle),
      badge: cleanSingleLine(header.badge),
      image: cleanSingleLine(header.image),
    },
    bodyMarkdown: bodyLines.join("\n").trim(),
  }
}

export function serializeCardBlock(
  header: CardBlockHeader,
  bodyMarkdown: string,
): string {
  const headerLines: Array<string> = []
  const title = cleanSingleLine(header.title)
  const subtitle = cleanSingleLine(header.subtitle)
  const badge = cleanSingleLine(header.badge)
  const image = cleanSingleLine(header.image)

  if (title) headerLines.push(`title: ${title}`)
  if (subtitle) headerLines.push(`subtitle: ${subtitle}`)
  if (badge) headerLines.push(`badge: ${badge}`)
  if (image) headerLines.push(`image: ${image}`)

  const trimmedBody = coalesceAlignedFences(bodyMarkdown.trim())
  const lines = [":::card"]

  if (headerLines.length > 0) {
    lines.push(...headerLines)
  }

  if (trimmedBody) {
    if (headerLines.length > 0) {
      lines.push("")
    }
    lines.push(trimmedBody)
  }

  lines.push(":::")
  return lines.join("\n")
}

// ---- 5. Moodboard (`:::moodboard`) -----------------------------------------

const MOODBOARD_KEYS = new Set(["title", "columns", "fit", "layout"])

export function createDefaultMoodboardItems(): Array<MoodboardItem> {
  return [
    { url: "", caption: "" },
    { url: "", caption: "" },
    { url: "", caption: "" },
    { url: "", caption: "" },
  ]
}

export function normalizeMoodboardColumns(value: unknown): MoodboardColumns {
  const num = Number(value)
  if (num === 3) return 3
  return 2
}

export function parseMoodboardBlock(raw: string): MoodboardBlockData {
  const lines = extractContainerBodyLines(raw)
  const { header, bodyLines } = splitHeaderAndBody(lines, MOODBOARD_KEYS)
  const items: Array<MoodboardItem> = []

  for (const rawLine of bodyLines) {
    const trimmed = rawLine.trim()
    if (!trimmed.startsWith("-")) continue
    const content = trimmed.slice(1).trim()
    const pipeIndex = content.indexOf("|")
    if (pipeIndex === -1) {
      items.push({ url: cleanSingleLine(content), caption: "" })
    } else {
      items.push({
        url: cleanSingleLine(content.slice(0, pipeIndex)),
        caption: cleanSingleLine(content.slice(pipeIndex + 1)),
      })
    }
  }

  return {
    title: cleanSingleLine(header.title),
    columns: normalizeMoodboardColumns(header.columns),
    fit: normalizeImageFit(header.fit),
    items: items.length > 0 ? items : createDefaultMoodboardItems(),
  }
}

export function normalizeMoodboardItems(value: unknown): Array<MoodboardItem> {
  if (!Array.isArray(value)) return []
  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      return {
        url: preserveSpacesSingleLine(record.url),
        caption: preserveSpacesSingleLine(record.caption),
      }
    })
    .filter((entry): entry is MoodboardItem => entry !== null)

  if (
    normalized.length === 1 &&
    !normalized[0].url &&
    normalized[0].caption === "Visual reference"
  ) {
    return createDefaultMoodboardItems()
  }

  return normalized
}

export function serializeMoodboardBlock(data: MoodboardBlockData): string {
  const title = cleanSingleLine(data.title)
  const columns = normalizeMoodboardColumns(data.columns)
  const fit = normalizeImageFit(data.fit)

  const headerLines: Array<string> = []
  if (title) headerLines.push(`title: ${title}`)
  if (columns === 3) {
    headerLines.push("columns: 3")
  }
  if (fit === "contain") {
    headerLines.push("fit: contain")
  }

  const effectiveItems =
    data.items.length > 0 ? data.items : createDefaultMoodboardItems()

  const itemLines = effectiveItems.map((item) => {
    const url = cleanSingleLine(item.url)
    const caption = cleanSingleLine(item.caption)
    if (url && caption) return `- ${url} | ${caption}`
    if (url) return `- ${url}`
    if (caption) return `- | ${caption}`
    return "-"
  })

  const lines = [":::moodboard", ...headerLines]
  if (itemLines.length > 0) {
    if (headerLines.length > 0) {
      lines.push("")
    }
    lines.push(...itemLines)
  }
  lines.push(":::")
  return lines.join("\n")
}

// ---- 6. Narrative Timeline (`:::timeline`) ---------------------------------

const TIMELINE_KEYS = new Set(["title"])

export function parseTimelineBlock(raw: string): TimelineBlockData {
  const lines = extractContainerBodyLines(raw)
  const { header, bodyLines } = splitHeaderAndBody(lines, TIMELINE_KEYS)
  const items: Array<TimelineBeatItem> = []

  for (const rawLine of bodyLines) {
    const trimmed = rawLine.trim()
    if (!trimmed.startsWith("-")) continue
    const content = trimmed.replace(/^-[ \t]*/, "")
    if (!content) continue

    const segments = content.split("|").map((part) => cleanSingleLine(part))
    const duration = segments[0] ?? ""
    const label = segments[1] ?? ""
    const scene = segments.slice(2).join(" | ").trim()

    items.push({
      duration,
      label,
      scene,
    })
  }

  return {
    title: cleanSingleLine(header.title),
    items,
  }
}

export function normalizeTimelineItems(
  value: unknown,
): Array<TimelineBeatItem> {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      return {
        duration: preserveSpacesSingleLine(record.duration),
        label: preserveSpacesSingleLine(record.label),
        scene: preserveSpacesSingleLine(record.scene),
      }
    })
    .filter((entry): entry is TimelineBeatItem => entry !== null)
}

export function serializeTimelineBlock(data: TimelineBlockData): string {
  const title = cleanSingleLine(data.title)
  const lines = [":::timeline"]
  if (title) {
    lines.push(`title: ${title}`)
  }

  const itemLines = data.items.map((item) => {
    const duration = cleanSingleLine(item.duration)
    const label = cleanSingleLine(item.label)
    const scene = cleanSingleLine(item.scene)
    if (scene) {
      return `- ${duration} | ${label} | ${scene}`
    }
    if (label) {
      return `- ${duration} | ${label}`
    }
    return `- ${duration}`
  })

  if (itemLines.length > 0) {
    if (title) {
      lines.push("")
    }
    lines.push(...itemLines)
  }

  lines.push(":::")
  return lines.join("\n")
}

/**
 * Parse a human duration token like `8s`, `1.5m`, `01:20` into seconds for
 * computing total duration and relative beat widths in the UI.
 */
export function parseDurationToSeconds(raw: string): number {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return 0

  const mmss = trimmed.match(/^(\d+):(\d{1,2})$/)
  if (mmss) {
    return Number(mmss[1]) * 60 + Number(mmss[2])
  }

  const secMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?$/)
  if (secMatch) {
    return Number(secMatch[1])
  }

  const minMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/)
  if (minMatch) {
    return Number(minMatch[1]) * 60
  }

  const numeric = Number(trimmed)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

export function formatTotalDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return ""
  if (totalSeconds < 60) {
    const rounded = Math.round(totalSeconds * 10) / 10
    return `${rounded}s`
  }
  const mins = Math.floor(totalSeconds / 60)
  const secs = Math.round(totalSeconds % 60)
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

// ---- 7. Inline Badge (`:badge[...]`) ---------------------------------------

export function normalizeBadgeColor(value: unknown): InlineBadgeColor {
  if (
    typeof value === "string" &&
    (INLINE_BADGE_COLORS as ReadonlyArray<string>).includes(value.trim())
  ) {
    return value.trim() as InlineBadgeColor
  }
  return "neutral"
}

export function serializeInlineBadge(
  label: string,
  color: InlineBadgeColor,
): string {
  const cleanLabel = cleanSingleLine(label) || "Badge"
  const normalizedColor = normalizeBadgeColor(color)
  return `:badge[${cleanLabel}]{color=${normalizedColor}}`
}

// ---- 8. Properties (`:::properties`) ---------------------------------------

const PROPERTIES_KEYS = new Set(["title", "layout"])
const PROPERTY_LINE_REGEX = /^-[ \t]+([^:]+?)(?::[ \t]*(.*))?$/

export function normalizePropertiesLayout(value: unknown): PropertiesLayout {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase()
    if ((PROPERTIES_LAYOUTS as ReadonlyArray<string>).includes(trimmed)) {
      return trimmed as PropertiesLayout
    }
  }
  return "grid"
}

export function parsePropertiesBlock(raw: string): PropertiesBlockData {
  const lines = extractContainerBodyLines(raw)
  const { header, bodyLines } = splitHeaderAndBody(lines, PROPERTIES_KEYS)
  const items: Array<PropertyItem> = []

  for (const rawLine of bodyLines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue
    const match = trimmed.match(PROPERTY_LINE_REGEX)
    if (!match) continue
    const key = cleanSingleLine(match[1])
    const value = cleanSingleLine(match[2])
    if (!key && !value) continue
    items.push({ key, value })
  }

  return {
    title: cleanSingleLine(header.title),
    layout: normalizePropertiesLayout(header.layout),
    items,
  }
}

export function normalizePropertyItems(value: unknown): Array<PropertyItem> {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      return {
        key: preserveSpacesSingleLine(record.key),
        value: preserveSpacesSingleLine(record.value),
      }
    })
    .filter((entry): entry is PropertyItem => entry !== null)
}

export function serializePropertiesBlock(data: PropertiesBlockData): string {
  const title = cleanSingleLine(data.title)
  const layout = normalizePropertiesLayout(data.layout)

  const lines = [":::properties"]
  if (title) {
    lines.push(`title: ${title}`)
  }
  lines.push(`layout: ${layout}`)

  for (const item of data.items) {
    const key = cleanSingleLine(item.key)
    const value = cleanSingleLine(item.value)
    lines.push(value ? `- ${key}: ${value}` : `- ${key}:`)
  }

  lines.push(":::")
  return lines.join("\n")
}

// ---- 9. Attributes (`:::attributes`) ---------------------------------------

const ATTRIBUTES_KEYS = new Set(["title"])
const ATTRIBUTE_ITEM_START_REGEX = /^-[ \t]+([^:]+?)(?::[ \t]*(.*))?$/

function cleanMultilineValue(value: unknown): string {
  if (typeof value !== "string") return ""
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
}

export function parseAttributesBlock(raw: string): AttributesBlockData {
  const allLines = extractContainerBodyLines(raw)
  const { header, bodyLines } = splitHeaderAndBody(allLines, ATTRIBUTES_KEYS)
  const items: Array<AttributeItem> = []

  let currentLabel: string | null = null
  let currentValueLines: Array<string> = []

  const flushCurrent = () => {
    if (currentLabel !== null) {
      items.push({
        label: currentLabel,
        value: currentValueLines.join("\n"),
      })
      currentLabel = null
      currentValueLines = []
    }
  }

  for (const rawLine of bodyLines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    if (trimmed.startsWith("- ") || trimmed === "-") {
      flushCurrent()
      const match = trimmed.match(ATTRIBUTE_ITEM_START_REGEX)
      if (match) {
        currentLabel = cleanSingleLine(match[1])
        const inlineValue = cleanSingleLine(match[2])
        if (inlineValue) {
          currentValueLines.push(inlineValue)
        }
      }
      continue
    }

    if (currentLabel !== null) {
      currentValueLines.push(trimmed)
    }
  }

  flushCurrent()

  return {
    title: cleanSingleLine(header.title),
    items,
  }
}

export function normalizeAttributeItems(value: unknown): Array<AttributeItem> {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      return {
        label: preserveSpacesSingleLine(record.label),
        value:
          typeof record.value === "string"
            ? record.value.replace(/\r\n/g, "\n")
            : "",
      }
    })
    .filter((entry): entry is AttributeItem => entry !== null)
}

export function serializeAttributesBlock(data: AttributesBlockData): string {
  const title = cleanSingleLine(data.title)
  const blocks = data.items.map((item) => {
    const label = cleanSingleLine(item.label)
    const valueLines = cleanMultilineValue(item.value)
      .split("\n")
      .filter(Boolean)
    if (valueLines.length === 0) {
      return `- ${label}:`
    }
    return `- ${label}:\n${valueLines.map((line) => `  ${line}`).join("\n")}`
  })

  const lines = [":::attributes"]
  if (title) {
    lines.push(`title: ${title}`)
  }
  if (blocks.length > 0) {
    if (title) {
      lines.push("")
    }
    lines.push(blocks.join("\n\n"))
  }
  lines.push(":::")
  return lines.join("\n")
}

// ---- 10. Hierarchy Tree (`:::tree`) ----------------------------------------

const TREE_KEYS = new Set(["title"])
const TREE_ITEM_LINE_REGEX = /^([ \t]*)-\s*(.*)$/
const TREE_COLLAPSED_MARKER_REGEX = /\s*\{collapsed\}\s*$/

function countIndentSpaces(indent: string): number {
  let spaces = 0
  for (const ch of indent) {
    if (ch === "\t") {
      spaces += 2
    } else if (ch === " ") {
      spaces += 1
    }
  }
  return spaces
}

function stripTreeCollapsedMarker(content: string): {
  content: string
  collapsed: boolean
} {
  const match = content.match(TREE_COLLAPSED_MARKER_REGEX)
  if (!match || match.index === undefined) {
    return { content, collapsed: false }
  }
  return {
    content: content.slice(0, match.index),
    collapsed: true,
  }
}

export function parseTreeBlock(raw: string): TreeBlockData {
  const allLines = extractContainerBodyLines(raw)
  const { header, bodyLines } = splitHeaderAndBody(allLines, TREE_KEYS)
  const items: Array<TreeItem> = []

  for (const rawLine of bodyLines) {
    if (!rawLine.trim()) continue
    const match = rawLine.match(TREE_ITEM_LINE_REGEX)
    if (!match) continue

    const indentSpaces = countIndentSpaces(match[1])
    const rawDepth = Math.max(0, Math.floor(indentSpaces / 2))
    const prevDepth = items.length > 0 ? items[items.length - 1].depth : -1
    const depth = Math.min(rawDepth, prevDepth + 1)

    const { content, collapsed } = stripTreeCollapsedMarker(match[2])
    const pipeIndex = content.indexOf("|")
    const label =
      pipeIndex === -1
        ? cleanSingleLine(content)
        : cleanSingleLine(content.slice(0, pipeIndex))
    const description =
      pipeIndex === -1 ? "" : cleanSingleLine(content.slice(pipeIndex + 1))

    if (!label && !description) continue

    items.push({
      label,
      description,
      depth,
      collapsed,
    })
  }

  return {
    title: cleanSingleLine(header.title),
    items,
  }
}

export function normalizeTreeItems(value: unknown): Array<TreeItem> {
  if (!Array.isArray(value)) return []
  const normalized: Array<TreeItem> = []

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    const rawDepth = Number(record.depth)
    const nonNegativeDepth =
      Number.isFinite(rawDepth) && rawDepth > 0 ? Math.floor(rawDepth) : 0
    const prevDepth =
      normalized.length > 0 ? normalized[normalized.length - 1].depth : -1
    const depth = Math.min(nonNegativeDepth, prevDepth + 1)

    normalized.push({
      label: preserveSpacesSingleLine(record.label),
      description: preserveSpacesSingleLine(record.description),
      depth,
      collapsed: Boolean(record.collapsed),
    })
  }

  return normalized
}

export function serializeTreeBlock(
  itemsOrData: ReadonlyArray<TreeItem> | TreeBlockData,
): string {
  const isDataObj = !Array.isArray(itemsOrData)
  const title = isDataObj
    ? cleanSingleLine((itemsOrData as TreeBlockData).title)
    : ""
  const rawItems = isDataObj
    ? (itemsOrData as TreeBlockData).items
    : (itemsOrData as ReadonlyArray<TreeItem>)
  const items = normalizeTreeItems(rawItems)

  const lines = [":::tree"]
  if (title) {
    lines.push(`title: ${title}`)
  }

  const itemLines = items.map((item) => {
    const indent = "  ".repeat(Math.max(0, item.depth))
    const label = cleanSingleLine(item.label)
    const description = cleanSingleLine(item.description)
    const collapsedSuffix = item.collapsed ? " {collapsed}" : ""
    if (description) {
      return `${indent}- ${label} | ${description}${collapsedSuffix}`
    }
    return `${indent}- ${label}${collapsedSuffix}`
  })

  if (itemLines.length > 0) {
    if (title) {
      lines.push("")
    }
    lines.push(...itemLines)
  }

  lines.push(":::")
  return lines.join("\n")
}
