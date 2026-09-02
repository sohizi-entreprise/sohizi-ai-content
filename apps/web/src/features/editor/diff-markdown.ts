import { diffLines, diffWordsWithSpace } from "diff"

const INSERT_OPEN = "{+"
const INSERT_CLOSE = "+}"
const DELETE_OPEN = "[-"
const DELETE_CLOSE = "-]"
const ESCAPE = "\\"

const RESERVED_SEQUENCES = [
  INSERT_OPEN,
  INSERT_CLOSE,
  DELETE_OPEN,
  DELETE_CLOSE,
] as const

declare const diffMarkdownBrand: unique symbol

/**
 * Branded so ordinary Markdown is less likely to be accidentally passed
 * to acceptDiffMarkdown or rejectDiffMarkdown.
 */
export type DiffMarkdown = string & {
  readonly [diffMarkdownBrand]: true
}

export type DiffPartKind = "equal" | "insert" | "delete"

export interface DiffPart {
  kind: DiffPartKind
  text: string

  /**
   * Present for insertions and deletions.
   * Stable for the lifetime of one generated proposal.
   */
  id?: string
}

export interface BuildDiffOptions {
  /**
   * Maximum time spent in each jsdiff calculation.
   */
  timeoutMs?: number

  /**
   * Maximum edit distance jsdiff should consider.
   */
  maxEditLength?: number

  /**
   * Avoid expensive word refinement for very large replacement blocks.
   */
  maxWordRefinementChars?: number

  /**
   * Only refine replacement blocks with at most this many lines.
   */
  maxWordRefinementLines?: number

  /**
   * Below this similarity, show a clean deletion followed by insertion
   * rather than a noisy word-level diff.
   *
   * Range: 0–1.
   */
  minWordSimilarity?: number
}

export interface MarkdownDiff {
  parts: Array<DiffPart>
  markdown: DiffMarkdown

  /**
   * True when the top-level line diff exceeded its configured limits and
   * the result had to fall back to a complete replacement.
   */
  usedFallback: boolean
}

interface ResolvedOptions {
  timeoutMs: number
  maxEditLength: number
  maxWordRefinementChars: number
  maxWordRefinementLines: number
  minWordSimilarity: number
}

interface LibraryChange {
  value: string
  added?: boolean
  removed?: boolean
}

export class DiffSyntaxError extends Error {
  readonly index: number

  constructor(message: string, index: number) {
    super(`${message} at character ${index}.`)
    this.name = "DiffSyntaxError"
    this.index = index
  }
}

/**
 * Main entry point.
 *
 * Both arguments must be plain, resolved Markdown—not annotated diff
 * Markdown.
 */
export function createMarkdownDiff(
  previousMarkdown: string,
  nextMarkdown: string,
  options: BuildDiffOptions = {},
): MarkdownDiff {
  const resolvedOptions = resolveOptions(options)

  if (previousMarkdown === nextMarkdown) {
    const parts = previousMarkdown
      ? [{ kind: "equal" as const, text: previousMarkdown }]
      : []

    return {
      parts,
      markdown: serializeDiffParts(parts),
      usedFallback: false,
    }
  }

  const lineChanges = diffLines(previousMarkdown, nextMarkdown, {
    ignoreWhitespace: false,
    newlineIsToken: true,
    timeout: resolvedOptions.timeoutMs,
    maxEditLength: resolvedOptions.maxEditLength,
  })

  if (!lineChanges) {
    const parts = assignChangeIds(
      compactParts([
        {
          kind: "delete",
          text: previousMarkdown,
        },
        {
          kind: "insert",
          text: nextMarkdown,
        },
      ]),
    )

    return {
      parts,
      markdown: serializeDiffParts(parts),
      usedFallback: true,
    }
  }

  const parts: Array<DiffPart> = []

  for (let index = 0; index < lineChanges.length; index += 1) {
    const current = lineChanges[index] as LibraryChange
    const next = lineChanges[index + 1] as LibraryChange | undefined

    if (current.removed && next?.added) {
      parts.push(
        ...refineReplacement(current.value, next.value, resolvedOptions),
      )

      index += 1
      continue
    }

    // Defensive handling in case an implementation emits addition first.
    if (current.added && next?.removed) {
      parts.push(
        ...refineReplacement(next.value, current.value, resolvedOptions),
      )

      index += 1
      continue
    }

    parts.push(changeToPart(current))
  }

  const finalizedParts = assignChangeIds(compactParts(parts))

  return {
    parts: finalizedParts,
    markdown: serializeDiffParts(finalizedParts),
    usedFallback: false,
  }
}

/**
 * Convenience wrapper when only the serialized syntax is needed.
 */
export function buildDiff(
  previousMarkdown: string,
  nextMarkdown: string,
  options: BuildDiffOptions = {},
): DiffMarkdown {
  return createMarkdownDiff(previousMarkdown, nextMarkdown, options).markdown
}

function refineReplacement(
  removedText: string,
  insertedText: string,
  options: ResolvedOptions,
): Array<DiffPart> {
  const totalLength = removedText.length + insertedText.length

  if (totalLength > options.maxWordRefinementChars) {
    return coarseReplacement(removedText, insertedText)
  }

  const removedLines = splitLinesPreservingEndings(removedText)
  const insertedLines = splitLinesPreservingEndings(insertedText)

  /*
   * Pairing lines by position is safe only when the line counts match.
   * Otherwise, word-level diffing across multiple lines can align words
   * from unrelated Markdown paragraphs or list items.
   */
  if (
    removedLines.length !== insertedLines.length ||
    removedLines.length > options.maxWordRefinementLines
  ) {
    return coarseReplacement(removedText, insertedText)
  }

  const result: Array<DiffPart> = []

  for (let index = 0; index < removedLines.length; index += 1) {
    result.push(
      ...refineLineReplacement(
        removedLines[index],
        insertedLines[index],
        options,
      ),
    )
  }

  return compactParts(result)
}

function refineLineReplacement(
  removedText: string,
  insertedText: string,
  options: ResolvedOptions,
): Array<DiffPart> {
  if (removedText === insertedText) {
    return [
      {
        kind: "equal",
        text: removedText,
      },
    ]
  }

  const changes = diffWordsWithSpace(removedText, insertedText, {
    timeout: options.timeoutMs,
    maxEditLength: options.maxEditLength,
  })

  if (!changes) {
    return coarseReplacement(removedText, insertedText)
  }

  if (
    getSimilarity(changes, removedText, insertedText) <
    options.minWordSimilarity
  ) {
    return coarseReplacement(removedText, insertedText)
  }

  return compactParts((changes as Array<LibraryChange>).map(changeToPart))
}

function getSimilarity(
  changes: Array<LibraryChange>,
  removedText: string,
  insertedText: string,
): number {
  const removedSignalLength = countNonWhitespace(removedText)
  const insertedSignalLength = countNonWhitespace(insertedText)
  const denominator = Math.max(removedSignalLength, insertedSignalLength)

  /*
   * Whitespace-only changes should still be refined exactly.
   */
  if (denominator === 0) {
    return 1
  }

  const unchangedSignalLength = changes.reduce((total, change) => {
    if (change.added || change.removed) {
      return total
    }

    return total + countNonWhitespace(change.value)
  }, 0)

  return unchangedSignalLength / denominator
}

function countNonWhitespace(value: string): number {
  return value.replace(/\s/g, "").length
}

function coarseReplacement(
  removedText: string,
  insertedText: string,
): Array<DiffPart> {
  return compactParts([
    {
      kind: "delete",
      text: removedText,
    },
    {
      kind: "insert",
      text: insertedText,
    },
  ])
}

function changeToPart(change: LibraryChange): DiffPart {
  if (change.added) {
    return {
      kind: "insert",
      text: change.value,
    }
  }

  if (change.removed) {
    return {
      kind: "delete",
      text: change.value,
    }
  }

  return {
    kind: "equal",
    text: change.value,
  }
}

/**
 * Serializes structured parts to:
 *
 *   {+inserted+}
 *   [-deleted-]
 *
 * Literal marker sequences and backslashes are escaped reversibly.
 */
export function serializeDiffParts(
  parts: ReadonlyArray<DiffPart>,
): DiffMarkdown {
  const value = parts
    .map((part) => {
      const escapedText = escapeDiffText(part.text)

      switch (part.kind) {
        case "equal":
          return escapedText

        case "insert":
          return `${INSERT_OPEN}${escapedText}${INSERT_CLOSE}`

        case "delete":
          return `${DELETE_OPEN}${escapedText}${DELETE_CLOSE}`

        default:
          return assertNever(part.kind)
      }
    })
    .join("")

  return value as DiffMarkdown
}

/**
 * Escaping examples:
 *
 *   {+          -> \{+
 *   +}          -> \+}
 *   [-          -> \[-
 *   -]          -> \-]
 *   \           -> \\
 *
 * This means AI-generated content may contain any marker sequence.
 */
export function escapeDiffText(text: string): string {
  let result = ""
  let index = 0

  while (index < text.length) {
    if (text[index] === ESCAPE) {
      result += `${ESCAPE}${ESCAPE}`
      index += 1
      continue
    }

    const reserved = getReservedSequenceAt(text, index)

    if (reserved) {
      result += `${ESCAPE}${reserved}`
      index += reserved.length
      continue
    }

    result += text[index]
    index += 1
  }

  return result
}

/**
 * Parses serialized diff Markdown back into structured parts.
 */
export function parseDiffMarkdown(markdown: string): Array<DiffPart> {
  const parts: Array<DiffPart> = []
  let equalBuffer = ""
  let index = 0

  const flushEqual = () => {
    if (!equalBuffer) {
      return
    }

    parts.push({
      kind: "equal",
      text: equalBuffer,
    })

    equalBuffer = ""
  }

  while (index < markdown.length) {
    const escaped = decodeEscapeAt(markdown, index)

    if (escaped) {
      equalBuffer += escaped.value
      index = escaped.nextIndex
      continue
    }

    if (markdown.startsWith(INSERT_OPEN, index)) {
      flushEqual()

      const parsed = readMarkedPayload(
        markdown,
        index + INSERT_OPEN.length,
        INSERT_CLOSE,
        "insert",
      )

      parts.push({
        kind: "insert",
        text: parsed.text,
      })

      index = parsed.nextIndex
      continue
    }

    if (markdown.startsWith(DELETE_OPEN, index)) {
      flushEqual()

      const parsed = readMarkedPayload(
        markdown,
        index + DELETE_OPEN.length,
        DELETE_CLOSE,
        "delete",
      )

      parts.push({
        kind: "delete",
        text: parsed.text,
      })

      index = parsed.nextIndex
      continue
    }

    equalBuffer += markdown[index]
    index += 1
  }

  flushEqual()

  return assignChangeIds(compactParts(parts))
}

function readMarkedPayload(
  markdown: string,
  startIndex: number,
  closingMarker: typeof INSERT_CLOSE | typeof DELETE_CLOSE,
  kind: "insert" | "delete",
): {
  text: string
  nextIndex: number
} {
  let text = ""
  let index = startIndex

  while (index < markdown.length) {
    const escaped = decodeEscapeAt(markdown, index)

    if (escaped) {
      text += escaped.value
      index = escaped.nextIndex
      continue
    }

    if (markdown.startsWith(closingMarker, index)) {
      return {
        text,
        nextIndex: index + closingMarker.length,
      }
    }

    text += markdown[index]
    index += 1
  }

  throw new DiffSyntaxError(`Unclosed ${kind} marker`, startIndex - 2)
}

function decodeEscapeAt(
  value: string,
  index: number,
):
  | {
      value: string
      nextIndex: number
    }
  | undefined {
  if (value[index] !== ESCAPE) {
    return undefined
  }

  if (value[index + 1] === ESCAPE) {
    return {
      value: ESCAPE,
      nextIndex: index + 2,
    }
  }

  for (const reserved of RESERVED_SEQUENCES) {
    if (value.startsWith(`${ESCAPE}${reserved}`, index)) {
      return {
        value: reserved,
        nextIndex: index + ESCAPE.length + reserved.length,
      }
    }
  }

  /*
   * Unknown escapes are preserved.
   *
   * This is useful for ordinary Markdown such as \* or \[ and makes the
   * parser tolerant of manually-authored content.
   */
  return {
    value: ESCAPE,
    nextIndex: index + 1,
  }
}

function getReservedSequenceAt(
  text: string,
  index: number,
): (typeof RESERVED_SEQUENCES)[number] | undefined {
  return RESERVED_SEQUENCES.find((sequence) => text.startsWith(sequence, index))
}

/**
 * Materializes either the accepted or rejected document.
 */
export function resolveDiffParts(
  parts: ReadonlyArray<DiffPart>,
  decision: "accept" | "reject" | ((part: DiffPart) => "accept" | "reject"),
): string {
  return parts
    .filter((part) => {
      if (part.kind === "equal") {
        return true
      }

      const resolvedDecision =
        typeof decision === "function" ? decision(part) : decision

      if (part.kind === "insert") {
        return resolvedDecision === "accept"
      }

      return resolvedDecision === "reject"
    })
    .map((part) => part.text)
    .join("")
}

export function acceptDiffMarkdown(markdown: DiffMarkdown): string {
  return resolveDiffParts(parseDiffMarkdown(markdown), "accept")
}

export function rejectDiffMarkdown(markdown: DiffMarkdown): string {
  return resolveDiffParts(parseDiffMarkdown(markdown), "reject")
}

/**
 * Validate and brand a diff string loaded from storage or an API.
 */
export function asDiffMarkdown(markdown: string): DiffMarkdown {
  parseDiffMarkdown(markdown)
  return markdown as DiffMarkdown
}

function compactParts(parts: ReadonlyArray<DiffPart>): Array<DiffPart> {
  const result: Array<DiffPart> = []

  for (const part of parts) {
    if (!part.text) {
      continue
    }

    const previous = result.at(-1)

    if (previous?.kind === part.kind) {
      previous.text += part.text
      continue
    }

    result.push({
      kind: part.kind,
      text: part.text,
    })
  }

  return result
}

function assignChangeIds(parts: ReadonlyArray<DiffPart>): Array<DiffPart> {
  const occurrences = new Map<string, number>()

  return parts.map((part) => {
    if (part.kind === "equal") {
      return { ...part }
    }

    const fingerprint = hashString(`${part.kind}\u0000${part.text}`)

    const occurrence = occurrences.get(fingerprint) ?? 0
    occurrences.set(fingerprint, occurrence + 1)

    return {
      ...part,
      id: `${part.kind}-${fingerprint}-${occurrence}`,
    }
  })
}

function hashString(value: string): string {
  // FNV-1a 32-bit hash. Used for UI identity, not security.
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)

    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36)
}

function splitLinesPreservingEndings(text: string): Array<string> {
  const lines: Array<string> = []
  let start = 0

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === "\r") {
      if (text[index + 1] === "\n") {
        index += 1
      }

      lines.push(text.slice(start, index + 1))
      start = index + 1
      continue
    }

    if (character === "\n") {
      lines.push(text.slice(start, index + 1))
      start = index + 1
    }
  }

  if (start < text.length) {
    lines.push(text.slice(start))
  }

  return lines
}

function resolveOptions(options: BuildDiffOptions): ResolvedOptions {
  return {
    timeoutMs: positiveInteger(options.timeoutMs, 250),
    maxEditLength: positiveInteger(options.maxEditLength, 25_000),
    maxWordRefinementChars: positiveInteger(
      options.maxWordRefinementChars,
      8_000,
    ),
    maxWordRefinementLines: positiveInteger(options.maxWordRefinementLines, 12),
    minWordSimilarity: clamp(options.minWordSimilarity ?? 0.2, 0, 1),
  }
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.floor(value)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}
