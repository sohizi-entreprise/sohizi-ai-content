import { Project } from "@/db/schema";
import { v4 as uuidv4 } from 'uuid'
import { parse as parsePartialJson } from 'partial-json'

/**
 * Build project context section
 */
export function buildProjectContext(project: Project): string {

    const { format, genre, tone, audience, durationMin } = project.brief

    const synopsis = project.synopsis
    
    return `
<project_context>
Here is the project context that you are currently working on:
**Project Requirements:**
- Title: ${project.synopsis?.title ?? 'Untitled'}
- Format: ${format}
- Genre: ${genre}
- Tone: ${tone}
- Audience: ${audience}
- Expected video duration: ${durationMin} minute(s)
- Expected script length: ${durationMin} pages - ${durationMin * 55} lines 

All content should align with these project requirements.

${synopsis ? `**Project Synopsis:**\n${synopsis.text}` : ''}
</project_context>
`
}


// ============================================================================
// SYNOPSIS COMPACT FORMAT CONVERSION
// ============================================================================

/**
 * Compact synopsis node from LLM
 * t = type (h1 for title, p for paragraph)
 * c = content (text)
 */
type CompactSynopsisNode = {
  t: 'h1' | 'p'
  c?: string
}

/**
 * TipTap prose node structure
 */
type ProseNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: Array<{ type: 'text'; text: string } | ProseNode>
}

export type ProseDocument = {
  type: 'doc'
  content: ProseNode[]
}

/** Map compact type to TipTap node type */
const SYNOPSIS_TYPE_MAP: Record<string, string> = {
  h1: 'synopsisTitle',
  p: 'synopsisContent',
}

/**
 * Get or create a block ID for a given index
 * If ID exists in map, return it. Otherwise create new ID and store it.
 */
function getOrCreateBlockId(index: number, blockIdMap: Map<number, string>): string {
  const existing = blockIdMap.get(index)
  if (existing) return existing
  
  const newId = uuidv4()
  blockIdMap.set(index, newId)
  return newId
}

/**
 * Convert a compact synopsis node to full TipTap prose node
 */
function enrichSynopsisNode(
  compact: CompactSynopsisNode, 
  index: number, 
  blockIdMap: Map<number, string>
): ProseNode {
  // Default to synopsisContent if type is empty/missing/invalid
  const type = SYNOPSIS_TYPE_MAP[compact.t] || 'synopsisContent'
  const blockId = getOrCreateBlockId(index, blockIdMap)
  
  const node: ProseNode = {
    type,
    attrs: { blockId },
  }

  if (compact.c) {
    node.content = [{ type: 'text', text: compact.c }]
  } 
  return node
}

/**
 * Convert compact synopsis array to full TipTap prose document
 * 
 * The blockIdMap is updated in place - pass the same map instance across
 * streaming updates to preserve block IDs.
 * 
 * Input:  [{ t: 'h1', c: 'Title' }, { t: 'p', c: 'Para 1' }, ...]
 * Output: { type: 'doc', content: [{ type: 'synopsisTitle', ... }, { type: 'synopsisDivider' }, ...] }
 */
export function synopsisCompactToProse(
  compact: CompactSynopsisNode[],
  blockIdMap: Map<number, string>
): ProseDocument {
  const content: ProseNode[] = []

  for (let i = 0; i < compact.length; i++) {
    const node = compact[i]
    const proseNode = enrichSynopsisNode(node, i, blockIdMap)
    content.push(proseNode)
    
    // Auto-insert divider after title (use negative index for divider)
    if (node.t === 'h1') {
      const dividerId = getOrCreateBlockId(-1, blockIdMap)
      content.push({
        type: 'synopsisDivider',
        attrs: { blockId: dividerId },
      })
    }
    
    // Auto-insert empty paragraph between consecutive paragraphs for visual spacing
    const nextNode = compact[i + 1]
    if (node.t === 'p' && nextNode?.t === 'p') {
      content.push({
        type: 'synopsisSpacer',
      })
    }
  }

  return { type: 'doc', content }
}

export function parseSynopsisStreamToProse(
  partialJson: string,
  blockIdMap: Map<number, string>
): ProseDocument | null {
  try {
    const parsed = parsePartialJson(partialJson)
    
    if (!Array.isArray(parsed)) {
      return null
    }

    return synopsisCompactToProse(parsed as CompactSynopsisNode[], blockIdMap)
  } catch {
    return null
  }
}
