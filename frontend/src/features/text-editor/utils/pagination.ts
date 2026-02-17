import type { PageInfo } from '../store/types'

// Standard screenplay page settings
export const PAGE_CONFIG = {
  // Lines per page (standard is 55-60 for screenplay)
  linesPerPage: 55,
  
  // Line height in pixels (for calculation)
  lineHeight: 18, // 12pt font * 1.5 line-height
  
  // Page dimensions in inches
  pageWidth: 8.5,
  pageHeight: 11,
  
  // Margins in inches
  marginTop: 1,
  marginBottom: 1,
  marginLeft: 1.5,
  marginRight: 1,
  
  // Usable height in lines
  get usableLines() {
    return this.linesPerPage
  },
}

// Line counts for different block types
export const BLOCK_LINE_COUNTS: Record<string, number> = {
  'scene-heading': 2, // Scene heading + blank line after
  'action': 1, // Per line of text
  'character': 2, // Character name + blank line before
  'parenthetical': 1,
  'dialogue': 1, // Per line of text
  'transition': 2, // Transition + blank line
  'shot': 1,
  'note': 2, // Note + margins
  'page-break': 0, // Forces page break
}

/**
 * Calculate page breaks for the document
 */
export function calculatePageBreaks(
  blocks: Array<{ id: string; type: string; content: string }>
): PageInfo[] {
  const pages: PageInfo[] = []
  let currentPage: PageInfo = {
    pageNumber: 1,
    startBlockId: blocks[0]?.id || '',
    endBlockId: '',
    lineCount: 0,
  }

  for (const block of blocks) {
    const blockLines = estimateBlockLines(block)

    // Check if this block would overflow the page
    if (currentPage.lineCount + blockLines > PAGE_CONFIG.linesPerPage) {
      // Check for orphan/widow control
      const shouldBreakBefore = shouldInsertPageBreak(block, currentPage.lineCount)

      if (shouldBreakBefore) {
        // End current page
        currentPage.endBlockId = block.id
        pages.push(currentPage)

        // Start new page
        currentPage = {
          pageNumber: pages.length + 1,
          startBlockId: block.id,
          endBlockId: '',
          lineCount: 0,
        }
      }
    }

    // Handle manual page breaks
    if (block.type === 'page-break') {
      currentPage.endBlockId = block.id
      pages.push(currentPage)

      currentPage = {
        pageNumber: pages.length + 1,
        startBlockId: block.id,
        endBlockId: '',
        lineCount: 0,
      }
      continue
    }

    currentPage.lineCount += blockLines
    currentPage.endBlockId = block.id
  }

  // Add the last page if it has content
  if (currentPage.lineCount > 0) {
    pages.push(currentPage)
  }

  return pages
}

/**
 * Estimate the number of lines a block will take
 */
function estimateBlockLines(block: { type: string; content: string }): number {
  const baseLines = BLOCK_LINE_COUNTS[block.type] || 1

  // For text-heavy blocks, estimate based on content length
  if (['action', 'dialogue'].includes(block.type)) {
    // Approximate characters per line (standard screenplay is ~60 chars)
    const charsPerLine = 60
    const contentLines = Math.ceil(block.content.length / charsPerLine)
    return Math.max(contentLines, 1) + (block.type === 'action' ? 1 : 0) // Add blank line after action
  }

  return baseLines
}

/**
 * Determine if a page break should be inserted before a block
 * Implements orphan/widow control
 */
function shouldInsertPageBreak(
  block: { type: string; content: string },
  currentLineCount: number
): boolean {
  const remainingLines = PAGE_CONFIG.linesPerPage - currentLineCount

  // Never break right before a scene heading (keep it with following content)
  if (block.type === 'scene-heading') {
    return remainingLines < 3 // Need at least 3 lines for scene heading + some content
  }

  // Never orphan a character name (keep with at least one line of dialogue)
  if (block.type === 'character') {
    return remainingLines < 4 // Character + parenthetical + at least 1 line dialogue
  }

  // Don't widow dialogue (keep at least 2 lines on a page)
  if (block.type === 'dialogue') {
    const dialogueLines = estimateBlockLines(block)
    if (dialogueLines > remainingLines && remainingLines < 2) {
      return true
    }
  }

  return remainingLines <= 0
}

/**
 * Get the page number for a given block ID
 */
export function getPageForBlock(pages: PageInfo[], blockId: string): number {
  for (const page of pages) {
    if (page.startBlockId === blockId || page.endBlockId === blockId) {
      return page.pageNumber
    }
  }
  return 1
}

/**
 * Format page number for display
 */
export function formatPageNumber(pageNumber: number, totalPages: number): string {
  return `${pageNumber}.`
}

/**
 * Calculate total page count
 */
export function getTotalPages(
  blocks: Array<{ id: string; type: string; content: string }>
): number {
  const pages = calculatePageBreaks(blocks)
  return pages.length
}
