import { v4 as uuid } from 'uuid'
import type { Block, BlockType } from '../store/types'
import { BLOCK_METADATA } from '../store/types'

/**
 * Create a new block with default values
 */
export function createBlock(
  type: BlockType,
  content: string = '',
  parentId: string | null = null
): Block {
  const meta = BLOCK_METADATA[type]

  return {
    id: uuid(),
    type,
    parentId,
    data: {
      content: content || meta.defaultContent,
    },
  }
}

/**
 * Convert blocks to plain text (for export)
 */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const meta = BLOCK_METADATA[block.type]
      let text = block.data.content

      // Apply formatting
      if (meta.autoFormat?.uppercase) {
        text = text.toUpperCase()
      }

      // Add appropriate spacing/indentation
      switch (block.type) {
        case 'scene-heading':
          return `\n${text}\n`
        case 'character':
          return `\n${''.padStart(20)}${text}`
        case 'parenthetical':
          return `${''.padStart(15)}(${text})`
        case 'dialogue':
          return `${''.padStart(10)}${text}`
        case 'transition':
          return `${''.padStart(50)}${text}\n`
        case 'page-break':
          return '\n\n===PAGE BREAK===\n\n'
        default:
          return text
      }
    })
    .join('\n')
}

/**
 * Convert blocks to Fountain format
 * Fountain is a plain text markup for screenplays
 */
export function blocksToFountain(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const content = block.data.content

      switch (block.type) {
        case 'scene-heading':
          // Scene headings start with INT., EXT., etc.
          return content.toUpperCase()
        case 'action':
          return content
        case 'character':
          // Character names are all caps
          return `\n${content.toUpperCase()}`
        case 'parenthetical':
          return `(${content})`
        case 'dialogue':
          return content
        case 'transition':
          // Transitions end with TO:
          return `\n> ${content.toUpperCase()}`
        case 'shot':
          return `\n.${content.toUpperCase()}`
        case 'note':
          return `[[${content}]]`
        case 'page-break':
          return '\n===\n'
        default:
          return content
      }
    })
    .join('\n')
}

/**
 * Parse Fountain format back to blocks
 */
export function fountainToBlocks(fountain: string): Block[] {
  const lines = fountain.split('\n')
  const blocks: Block[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    if (!line) {
      i++
      continue
    }

    // Scene heading (INT., EXT., etc.)
    if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/.test(line.toUpperCase())) {
      blocks.push(createBlock('scene-heading', line))
      i++
      continue
    }

    // Transition (ends with TO: or starts with >)
    if (line.startsWith('>') || /TO:$/.test(line.toUpperCase())) {
      blocks.push(createBlock('transition', line.replace(/^>\s*/, '')))
      i++
      continue
    }

    // Shot (starts with .)
    if (line.startsWith('.')) {
      blocks.push(createBlock('shot', line.substring(1)))
      i++
      continue
    }

    // Note (wrapped in [[]])
    if (line.startsWith('[[') && line.endsWith(']]')) {
      blocks.push(createBlock('note', line.slice(2, -2)))
      i++
      continue
    }

    // Page break
    if (line === '===') {
      blocks.push(createBlock('page-break'))
      i++
      continue
    }

    // Character (all caps, not a scene heading)
    if (line === line.toUpperCase() && /^[A-Z]/.test(line) && !line.includes('.')) {
      blocks.push(createBlock('character', line))
      i++

      // Check for parenthetical and dialogue
      while (i < lines.length) {
        const nextLine = lines[i].trim()
        if (!nextLine) {
          i++
          break
        }

        if (nextLine.startsWith('(') && nextLine.endsWith(')')) {
          blocks.push(createBlock('parenthetical', nextLine.slice(1, -1)))
        } else if (nextLine !== nextLine.toUpperCase()) {
          blocks.push(createBlock('dialogue', nextLine))
        } else {
          break
        }
        i++
      }
      continue
    }

    // Default to action
    blocks.push(createBlock('action', line))
    i++
  }

  return blocks
}

/**
 * Get the next logical block type after the current one
 */
export function getNextBlockType(currentType: BlockType): BlockType {
  const flow: Record<BlockType, BlockType> = {
    'scene-heading': 'action',
    'action': 'character',
    'character': 'dialogue',
    'parenthetical': 'dialogue',
    'dialogue': 'action',
    'transition': 'scene-heading',
    'shot': 'action',
    'note': 'action',
    'page-break': 'scene-heading',
  }

  return flow[currentType] || 'action'
}

/**
 * Validate block content based on type
 */
export function validateBlockContent(
  type: BlockType,
  content: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  switch (type) {
    case 'scene-heading':
      if (!/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(content)) {
        errors.push('Scene heading should start with INT., EXT., or INT/EXT.')
      }
      if (!content.includes(' - ')) {
        errors.push('Scene heading should include time of day (e.g., " - DAY")')
      }
      break

    case 'character':
      if (content !== content.toUpperCase()) {
        errors.push('Character name should be in ALL CAPS')
      }
      break

    case 'transition':
      if (!content.toUpperCase().endsWith(':')) {
        errors.push('Transition should end with a colon (e.g., "CUT TO:")')
      }
      break
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
