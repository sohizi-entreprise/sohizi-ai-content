import {
  applyPatch,
  diffLines,
  diffWordsWithSpace,
  structuredPatch,
} from "diff"

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

export class RejectMergeConflictError extends Error {
  constructor(
    message = "Could not keep your edits while rejecting the suggestion.",
  ) {
    super(message)
    this.name = "RejectMergeConflictError"
  }
}

/**
 * Main entry point.
 *
 * Both arguments must be plain, resolved Markdown.
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
    return {
      parts: assignChangeIds(
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
      ),
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

  return {
    parts: assignChangeIds(compactParts(parts)),
    usedFallback: false,
  }
}

export interface DiffHunk {
  id: string
  deleted: string
  inserted: string
}

export function getMarkdownChangeParts(
  previousMarkdown: string,
  nextMarkdown: string,
  options: BuildDiffOptions = {},
): Array<DiffPart> {
  return createMarkdownDiff(
    previousMarkdown,
    nextMarkdown,
    options,
  ).parts.filter((part) => part.kind !== "equal")
}

const MAX_BRIDGE_CHARS = 48
const MAX_BRIDGE_WORDS = 4

/**
 * Groups nearby word-level fragments into reviewable hunks.
 *
 * Wrapping `confident` as `**confident**` becomes one replacement instead of
 * two isolated `**` insertions.
 */
export function getMarkdownChangeHunks(
  previousMarkdown: string,
  nextMarkdown: string,
  options: BuildDiffOptions = {},
): Array<DiffHunk> {
  const parts = createMarkdownDiff(
    previousMarkdown,
    nextMarkdown,
    options,
  ).parts
  const hunks: Array<DiffHunk> = []
  let cluster: Array<DiffPart> = []
  let pendingBridge: DiffPart | null = null

  const flush = () => {
    if (cluster.length === 0) return

    const deleted = cluster
      .filter((part) => part.kind !== "insert")
      .map((part) => part.text)
      .join("")
    const inserted = cluster
      .filter((part) => part.kind !== "delete")
      .map((part) => part.text)
      .join("")

    if (deleted || inserted) {
      hunks.push({
        id: `hunk-${hunks.length}-${hashString(`${deleted}\u0000${inserted}`)}`,
        deleted,
        inserted,
      })
    }

    cluster = []
    pendingBridge = null
  }

  for (const part of parts) {
    if (part.kind !== "equal") {
      if (pendingBridge) {
        cluster.push(pendingBridge)
        pendingBridge = null
      }
      cluster.push(part)
      continue
    }

    if (cluster.length === 0) {
      continue
    }

    if (isLocalBridge(part.text)) {
      pendingBridge = part
      continue
    }

    flush()
  }

  flush()

  return hunks
}

function isLocalBridge(text: string): boolean {
  if (!text || /[\r\n]/.test(text)) {
    return false
  }

  if (text.length > MAX_BRIDGE_CHARS) {
    return false
  }

  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length <= MAX_BRIDGE_WORDS
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
 * Restores the accepted document while keeping unrelated manual edits.
 *
 * The user delta is derived from `proposal → current` and applied to
 * `baseContent`. Overlapping edits throw instead of dropping work.
 */
export function rejectPendingMarkdown(args: {
  baseContent: string
  proposal: string
  current: string
}): string {
  const baseContent = normalizeMarkdown(args.baseContent)
  const proposal = normalizeMarkdown(args.proposal)
  const current = normalizeMarkdown(args.current)

  if (current === proposal || current === baseContent) {
    return restoreMarkdownShape(baseContent, args.baseContent)
  }

  const patch = structuredPatch(
    "proposal",
    "current",
    proposal,
    current,
    undefined,
    undefined,
    { context: 0 },
  )
  const merged = applyPatch(baseContent, patch)

  if (merged === false) {
    throw new RejectMergeConflictError()
  }

  return restoreMarkdownShape(merged, args.baseContent)
}

function normalizeMarkdown(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "")
}

function restoreMarkdownShape(merged: string, original: string): string {
  if (original.endsWith("\n") && !merged.endsWith("\n")) {
    return `${merged}\n`
  }

  return merged
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
