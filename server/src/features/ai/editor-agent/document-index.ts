import { Project } from '@/db/schema'
import type { DocumentId, ProseDocument, ProseNode } from '@/type'
import type { StoryBible } from 'zSchemas'

// ============================================================================
// CONSTANTS
// ============================================================================

const SNIPPET_RADIUS = 50
const SNIPPET_MAX = 120
const LABEL_MAX_LEN = 36

const PROSE_DOCUMENT_IDS: DocumentId[] = ['synopsis', 'script']
const EMPTY_RESULT_MESSAGE = 'No blocks found'

// ============================================================================
// TYPES
// ============================================================================

/**
 * One node in the document outline (table of contents).
 * Used to describe structure without loading full block content.
 */
export type OutlineNode = {
  /** Block identifier from the editor (e.g. from attrs.blockId). Used for O(1) lookup and targeted reads. */
  blockId: string
  /** Prose block type (e.g. "scene", "action", "paragraph"). */
  type: string
  /** Short preview of the block's text content (first ~36 chars). Helps identify the block without reading it. */
  label?: string
  /** Nested outline nodes for hierarchical structure (e.g. scene → blocks). */
  children?: OutlineNode[]
  /** Block IDs of user-selected snippets (contextAnchor marks) inside this block. Agent can use these to fetch snippet content. */
  anchorBlockIds?: string[]
}

export type BlockEntry = {
  blockId: string
  documentId: DocumentId
  type: string
  content: string
  orderIndex: number
  label?: string
  /** Set for entries that represent a contextAnchor snippet; points to the containing block. */
  parentBlockId?: string
}

/** Search index entry: no content stored; snippet is built from byId at search time. */
export type SearchBlockEntry = {
  blockId: string
  documentId: DocumentId
  contentLower: string
  type: string
}

export type DocumentBlockIndex = {
  byId: Map<string, BlockEntry>
  byDocument: Map<DocumentId, BlockEntry[]>
  outlineByDocument: Map<DocumentId, OutlineNode[]>
  searchList: SearchBlockEntry[]
}

export type SearchDocumentMatch = {
  documentId: DocumentId
  blockId: string
  blockType: string
  snippet: string
}

// ============================================================================
// INTERNAL HELPERS (single-pass node processing)
// ============================================================================

function extractFullText(node: ProseNode): string {
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content)) return ''
  return node.content
    .map((c) =>
      c && typeof c === 'object' && 'text' in c
        ? (c as { text?: string }).text ?? ''
        : extractFullText(c as ProseNode)
    )
    .join('')
}

function extractPreview(node: ProseNode, maxLen: number): string {
  if (typeof node.text === 'string') return node.text.slice(0, maxLen).trim()
  if (!Array.isArray(node.content)) return ''
  const parts: string[] = []
  for (const c of node.content) {
    if (c && typeof c === 'object' && 'text' in c && typeof (c as { text?: string }).text === 'string') {
      parts.push((c as { text: string }).text)
    } else if (c && typeof c === 'object' && 'type' in c) {
      parts.push(extractPreview(c as ProseNode, maxLen - parts.join('').length))
    }
    if (parts.join('').length >= maxLen) break
  }
  return parts.join('').slice(0, maxLen).trim()
}

function isStructuralOnly(node: ProseNode): boolean {
  const blockId = node.attrs?.blockId as string | undefined
  return blockId == null && (node.type === 'synopsisSpacer' || node.type === 'synopsisDivider')
}

/** Inline text node with optional marks (e.g. contextAnchor). */
type InlineTextNode = { type: 'text'; text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> }

function extractContextAnchors(node: ProseNode): { blockId: string; text: string }[] {
  const out: { blockId: string; text: string }[] = []
  if (!Array.isArray(node.content)) return out
  for (const c of node.content) {
    if (!c || typeof c !== 'object') continue
    if ('text' in c && typeof (c as InlineTextNode).text === 'string') {
      const inline = c as InlineTextNode
      const marks = Array.isArray(inline.marks) ? inline.marks : []
      const anchor = marks.find((m) => m && m.type === 'contextAnchor')
      const blockId = anchor?.attrs?.blockId
      if (typeof blockId === 'string' && blockId.trim()) {
        out.push({ blockId: blockId.trim(), text: inline.text ?? '' })
      }
    }
    if ('content' in c && Array.isArray((c as ProseNode).content)) {
      out.push(...extractContextAnchors(c as ProseNode))
    }
  }
  return out
}

function buildOutlineNode(
  node: ProseNode,
  orderFallback: number,
  labelPrecomputed?: string,
  anchorBlockIds?: string[]
): OutlineNode | null {
  if (isStructuralOnly(node)) return null
  const blockId = (node.attrs?.blockId ?? `_order_${orderFallback}`) as string
  const label = labelPrecomputed ?? extractPreview(node, LABEL_MAX_LEN)
  const outline: OutlineNode = {
    blockId,
    type: node.type,
    ...(label && { label }),
    ...(anchorBlockIds?.length ? { anchorBlockIds } : undefined),
  }
  if (Array.isArray(node.content)) {
    const children: OutlineNode[] = []
    node.content.forEach((child, i) => {
      if (child && typeof child === 'object' && 'type' in child && typeof (child as ProseNode).type === 'string') {
        const childOutline = buildOutlineNode(child as ProseNode, i)
        if (childOutline) children.push(childOutline)
      }
    })
    if (children.length > 0) outline.children = children
  }
  return outline
}

function snippetAroundMatch(content: string, queryLower: string): string {
  const idx = content.toLowerCase().indexOf(queryLower)
  if (idx === -1) return ''
  const start = Math.max(0, idx - SNIPPET_RADIUS)
  const end = Math.min(content.length, idx + queryLower.length + SNIPPET_RADIUS)
  let s = content.slice(start, end).trim()
  if (s.length > SNIPPET_MAX) s = s.slice(0, SNIPPET_MAX) + '…'
  if (start > 0) s = '…' + s
  if (end < content.length) s = s + '…'
  return s
}

function processProseDoc(
  doc: ProseDocument,
  documentId: DocumentId
): { blocks: BlockEntry[]; outline: OutlineNode[]; searchEntries: SearchBlockEntry[]; snippetEntries: BlockEntry[] } {
  const blocks: BlockEntry[] = []
  const outline: OutlineNode[] = []
  const searchEntries: SearchBlockEntry[] = []
  const snippetEntries: BlockEntry[] = []

  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return { blocks, outline, searchEntries, snippetEntries }

  doc.content.forEach((node, order) => {
    if (isStructuralOnly(node)) return

    const blockId = (node.attrs?.blockId ?? `_order_${order}`) as string
    const type = node.type
    const content = extractFullText(node)
    const label = extractPreview(node, LABEL_MAX_LEN)

    const anchors = extractContextAnchors(node)
    const anchorBlockIds = anchors.map((a) => a.blockId)

    const entry: BlockEntry = {
      blockId,
      documentId,
      type,
      content,
      orderIndex: blocks.length,
      ...(label && { label }),
    }
    blocks.push(entry)
    searchEntries.push({
      blockId,
      documentId,
      contentLower: content.toLowerCase(),
      type,
    })

    for (const { blockId: anchorId, text } of anchors) {
      const snippetLabel = text.slice(0, LABEL_MAX_LEN).trim()
      snippetEntries.push({
        blockId: anchorId,
        documentId,
        type: 'contextAnchor',
        content: text,
        orderIndex: blocks.length - 1,
        parentBlockId: blockId,
        ...(snippetLabel && { label: snippetLabel }),
      })
    }

    const outlineNode = buildOutlineNode(node, order, label, anchorBlockIds.length ? anchorBlockIds : undefined)
    if (outlineNode) outline.push(outlineNode)
  })

  return { blocks, outline, searchEntries, snippetEntries }
}

// ============================================================================
// BUILD INDEX (single pass over documents that exist on project)
// ============================================================================

/**
 * Builds the document block index in a single pass over each ProseDocument
 * (script, synopsis) that exists on the project. Supports O(1) lookup by
 * block ID and efficient outline/search/context access for read tools.
 */
export function buildDocumentBlockIndex(project: Project): DocumentBlockIndex {
  const byId = new Map<string, BlockEntry>()
  const byDocument = new Map<DocumentId, BlockEntry[]>()
  const outlineByDocument = new Map<DocumentId, OutlineNode[]>()
  const searchList: SearchBlockEntry[] = []

  for (const documentId of PROSE_DOCUMENT_IDS) {
    const raw =
      documentId === 'script'
        ? (project.script as ProseDocument | null)
        : (project.synopsis as ProseDocument | null)

    const isProseDoc =
      raw &&
      typeof raw === 'object' &&
      'type' in raw &&
      raw.type === 'doc' &&
      Array.isArray((raw as { content?: unknown }).content)

    if (!isProseDoc) continue

    const doc = raw as ProseDocument
    const { blocks, outline, searchEntries, snippetEntries } = processProseDoc(doc, documentId)

    byDocument.set(documentId, blocks)
    outlineByDocument.set(documentId, outline)
    searchList.push(...searchEntries)

    for (const entry of blocks) {
      byId.set(entry.blockId, entry)
    }
    for (const entry of snippetEntries) {
      byId.set(entry.blockId, entry)
      searchList.push({
        blockId: entry.blockId,
        documentId: entry.documentId,
        contentLower: entry.content.toLowerCase(),
        type: entry.type,
      })
    }
  }

  return {
    byId,
    byDocument,
    outlineByDocument,
    searchList,
  }
}

// ============================================================================
// ACCESSORS (used by read tools)
// ============================================================================

/**
 * Returns the precomputed outline for a document. O(1).
 * Returns a shallow copy so callers cannot mutate the index.
 */
export function getOutline(index: DocumentBlockIndex, documentId: DocumentId): OutlineNode[] {
  return [...(index.outlineByDocument.get(documentId) ?? [])]
}

/**
 * Searches the index for blocks containing the query. Single in-memory scan
 * over the search list (no ProseDocument traversal).
 */
export function search(
  index: DocumentBlockIndex,
  documentIds: DocumentId[],
  query: string
): SearchDocumentMatch[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const docSet = documentIds.length > 0 ? new Set(documentIds) : new Set(PROSE_DOCUMENT_IDS)
  const results: SearchDocumentMatch[] = []

  for (const entry of index.searchList) {
    if (!docSet.has(entry.documentId)) continue
    if (!entry.contentLower.includes(q)) continue
    const block = index.byId.get(entry.blockId)
    if (!block) continue
    results.push({
      documentId: entry.documentId,
      blockId: entry.blockId,
      blockType: entry.type,
      snippet: snippetAroundMatch(block.content, q),
    })
  }

  return results
}

/**
 * Returns the content of the block for the given block ID. O(1) lookup.
 * Format: [blockId:blockType]\ncontent. Returns 'No blocks found' when not found.
 */
export function getBlockContext(index: DocumentBlockIndex, blockId: string): string {
  const entry = index.byId.get(blockId)
  if (!entry) return EMPTY_RESULT_MESSAGE
  return `[${entry.blockId}:${entry.type}]\n${entry.content}`
}

/**
 * O(1) lookup of a block by ID. Returns content only, or null if not found.
 */
export function getBlockById(index: DocumentBlockIndex, blockId: string): BlockEntry | null {
  return index.byId.get(blockId) ?? null
}

// ============================================================================
// TOKEN-EFFICIENT STRING FORMATTERS
// ============================================================================

function formatOutlineNode(
  node: OutlineNode,
  depth: number,
  indentSize: number,
  lines: string[]
): void {
  const indent = ' '.repeat(indentSize * depth)
  const label = (node.label ?? '').replace(/\s+/g, ' ').trim() || '-'
  lines.push(`${indent}[${node.blockId}:${node.type}] ${label}`)
  if (node.anchorBlockIds?.length) {
    const childIndent = ' '.repeat(indentSize * (depth + 1))
    lines.push(`${childIndent}anchors: ${node.anchorBlockIds.join(' ')}`)
  }
  if (node.children?.length) {
    for (const child of node.children) {
      formatOutlineNode(child, depth + 1, indentSize, lines)
    }
  }
}

/**
 * Formats outline nodes as a flattened, token-efficient string.
 * Line format: [blockId:blockType] label. Two spaces indentation per depth.
 * Returns 'No blocks found' when nodes is empty.
 */
export function formatOutlineAsText(
  nodes: OutlineNode[],
  options?: { indentSize?: number }
): string {
  if (nodes.length === 0) return EMPTY_RESULT_MESSAGE
  const indentSize = options?.indentSize ?? 2
  const lines: string[] = []
  for (const node of nodes) {
    formatOutlineNode(node, 0, indentSize, lines)
  }
  return lines.join('\n')
}

/**
 * Formats search matches as a token-efficient string with cross-doc clarity.
 * Document id on its own line, then each match as [blockId:blockType] snippet.
 * Returns 'No blocks found' when matches is empty.
 */
export function formatSearchResultsAsText(matches: SearchDocumentMatch[]): string {
  if (matches.length === 0) return EMPTY_RESULT_MESSAGE
  const byDoc = new Map<DocumentId, SearchDocumentMatch[]>()
  for (const m of matches) {
    const list = byDoc.get(m.documentId) ?? []
    list.push(m)
    byDoc.set(m.documentId, list)
  }
  const lines: string[] = []
  for (const documentId of PROSE_DOCUMENT_IDS) {
    const list = byDoc.get(documentId)
    if (!list?.length) continue
    lines.push(documentId)
    for (const m of list) {
      lines.push(`[${m.blockId}:${m.blockType}] ${m.snippet}`)
    }
  }
  return lines.join('\n')
}

// ============================================================================
// STORY BIBLE FORMATTERS
// ============================================================================

export type StoryBibleCharacter = StoryBible['characters'][number]
export type StoryBibleLocation = StoryBible['locations'][number]
export type StoryBibleProp = StoryBible['props'][number]
export type StoryBibleEntity = StoryBibleCharacter | StoryBibleLocation | StoryBibleProp
type StoryBibleEntityType = 'character' | 'location' | 'prop'

/**
 * Looks up an entity by id and type from the project's story_bible.
 * Returns null if not found or story_bible is missing.
 */
export function getEntityDefinition(
  project: Project,
  entityId: string,
  entityType: StoryBibleEntityType
): StoryBibleEntity | null {
  const id = entityId?.trim()
  if (!id) return null
  const bible = project.story_bible as StoryBible | null
  if (!bible) return null
  let list: StoryBible['characters'] | StoryBible['locations'] | StoryBible['props'] | undefined
  switch (entityType) {
    case 'character':
      list = Array.isArray(bible.characters) ? bible.characters : undefined
      break
    case 'location':
      list = Array.isArray(bible.locations) ? bible.locations : undefined
      break
    case 'prop':
      list = Array.isArray(bible.props) ? bible.props : undefined
      break
    default:
      return null
  }
  if (!list) return null
  const entity = list.find((e) => e.id === id)
  return (entity ?? null) as StoryBibleEntity | null
}

/**
 * Returns the story bible outline in token-optimized format.
 * Section headers (characters, locations, props) each followed by lines [id] name.
 * Returns 'No blocks found' when storyBible is null or all sections empty.
 */
export function formatStoryBibleOutline(storyBible: StoryBible | null): string {
  if (!storyBible) return EMPTY_RESULT_MESSAGE
  const lines: string[] = []
  const chars = Array.isArray(storyBible.characters) ? storyBible.characters : []
  const locs = Array.isArray(storyBible.locations) ? storyBible.locations : []
  const prps = Array.isArray(storyBible.props) ? storyBible.props : []
  if (chars.length === 0 && locs.length === 0 && prps.length === 0) return EMPTY_RESULT_MESSAGE

  if (chars.length > 0) {
    for (const c of chars) {
      lines.push(`[${c.id}:character] ${c.name}`)
    }
  }
  if (locs.length > 0) {
    for (const l of locs) {
      lines.push(`[${l.id}:location] ${l.name}`)
    }
  }
  if (prps.length > 0) {
    for (const p of prps) {
      lines.push(`[${p.id}:prop] ${p.name}`)
    }
  }
  return lines.join('\n')
}

/**
 * Formats a single entity definition in token-optimized format.
 * First line: [entityId:entityType] name. Then indented (2 spaces) fields.
 * Returns 'No blocks found' when entity is null.
 */
export function formatEntityDefinition(
  entity: StoryBibleEntity | null,
  entityType: StoryBibleEntityType
): string {
  if (!entity) return EMPTY_RESULT_MESSAGE
  const lines: string[] = []
  const id = 'id' in entity ? entity.id : ''
  const name = 'name' in entity ? entity.name : ''
  lines.push(`[${id}:${entityType}] ${name}`)

  if (entityType === 'character') {
    const c = entity as StoryBibleCharacter
    if (c.role != null) lines.push(`  Role: ${c.role}`)
    if (c.age != null) lines.push(`  Age: ${c.age}`)
    if (c.occupation != null) lines.push(`  Occupation: ${c.occupation}`)
    if (c.physicalDescription != null) lines.push(`  Physical description: ${c.physicalDescription}`)
    if (c.personalityTraits?.length) lines.push(`  Personality traits: ${c.personalityTraits.join(', ')}`)
    if (c.backstory != null) lines.push(`  Backstory: ${c.backstory}`)
    if (c.motivation != null) lines.push(`  Motivation: ${c.motivation}`)
    if (c.flaw != null) lines.push(`  Flaw: ${c.flaw}`)
    if (c.voice != null) lines.push(`  Voice: ${c.voice}`)
  } else if (entityType === 'location') {
    const l = entity as StoryBibleLocation
    if (l.description != null) lines.push(`  Description: ${l.description}`)
    if (l.atmosphere != null) lines.push(`  Atmosphere: ${l.atmosphere}`)
  } else if (entityType === 'prop') {
    const p = entity as StoryBibleProp
    if (p.description != null) lines.push(`  Description: ${p.description}`)
  }

  return lines.join('\n')
}
