import { Project } from "@/db/schema";
import { v4 as uuidv4 } from 'uuid'
import { parse as parsePartialJson } from 'partial-json'

/**
 * Returns a string describing each document's id, availability status, and supported block/entity types.
 * Used to inform the AI which documents exist and what it can edit.
 */
export function returnSupportedTypePerDocument(project: Project): string {
  const sections: string[] = []

  // Synopsis
  const synopsisStatus = project.synopsis
    ? 'Available - can be edited'
    : 'Not available - cannot be edited yet.'
  sections.push(`Synopsis
documentId: synopsis
Status: ${synopsisStatus}
supported blocktypes:
- title
- paragraph
- selection`)

  // Script
  const scriptStatus = project.script
    ? 'Available - can be edited'
    : 'Not available - cannot be edited yet.'
  sections.push(`Script
documentId: script
Status: ${scriptStatus}
supported blocktypes:
- title
- logline
- segment
- slugline
- action
- parenthetical
- dialogue
- character
- transition
- shot
- paragraph
- selection`)

  // Story Bible (from zSchemas: timePeriod, setting, characters[], locations[], props[])
  const storyBibleStatus = project.story_bible
    ? 'Generated - can be edited'
    : 'Not available - cannot be edited yet.'
  sections.push(`Story Bible
documentId: story_bible
Status: ${storyBibleStatus}
supported Entities:
- characters [array of]
- locations [array of]
- props [array of]

Character fields:
  - id [unique across the document]
  - name
  - role [protagonist | antagonist | supporting | minor]
  - age
  - occupation
  - physicalDescription
  - personalityTraits
  - backstory
  - motivation
  - flaw
  - voice
Location fields:
  - id
  - name
  - description
  - atmosphere
Prop:
  - id
  - name
  - description`)

  return sections.join('\n\n')
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
