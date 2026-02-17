import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { EditorContent } from '@tiptap/react'
import { useEditorStore } from '../store/editor-store'
import { calculatePageBreaks, PAGE_CONFIG, formatPageNumber } from '../utils/pagination'
import { cn } from '@/lib/utils'

type PaginatedViewProps = {
  editor: Editor
  className?: string
}

/**
 * Renders the editor content with visual page breaks and page numbers
 */
export function PaginatedView({ editor, className }: PaginatedViewProps) {
  const { pages, setPages, currentPage, setCurrentPage } = useEditorStore()
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate pages when content changes
  useEffect(() => {
    const updatePages = () => {
      const blocks: Array<{ id: string; type: string; content: string }> = []

      editor.state.doc.descendants((node) => {
        if (node.attrs?.id) {
          blocks.push({
            id: node.attrs.id,
            type: node.type.name,
            content: node.textContent,
          })
        }
      })

      const newPages = calculatePageBreaks(blocks)
      setPages(newPages)
    }

    // Initial calculation
    updatePages()

    // Update on content change
    editor.on('update', updatePages)

    return () => {
      editor.off('update', updatePages)
    }
  }, [editor, setPages])

  // Track current page based on scroll position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const pageHeight = PAGE_CONFIG.pageHeight * 96 // Convert inches to pixels (96 DPI)
      const newPage = Math.floor(scrollTop / pageHeight) + 1
      
      if (newPage !== currentPage && newPage <= pages.length) {
        setCurrentPage(newPage)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [currentPage, pages.length, setCurrentPage])

  const totalPages = pages.length || 1

  return (
    <div className={cn('paginated-view', className)}>
      {/* Page indicator */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-white/10 px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <PageNavigator
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Scrollable content with page markers */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-8"
      >
        <div className="relative">
          {/* Page containers */}
          {pages.map((page, index) => (
            <PageContainer
              key={page.pageNumber}
              pageNumber={page.pageNumber}
              totalPages={totalPages}
              isActive={page.pageNumber === currentPage}
            >
              {index === 0 && <EditorContent editor={editor} />}
            </PageContainer>
          ))}

          {/* Fallback if no pages calculated yet */}
          {pages.length === 0 && (
            <PageContainer pageNumber={1} totalPages={1} isActive>
              <EditorContent editor={editor} />
            </PageContainer>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Visual page container with page number
 */
function PageContainer({
  pageNumber,
  totalPages,
  isActive,
  children,
}: {
  pageNumber: number
  totalPages: number
  isActive: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'page-container relative',
        'max-w-[8.5in] mx-auto mb-8',
        'bg-[oklch(0.12_0.01_270)] rounded-lg',
        'shadow-lg',
        isActive && 'ring-2 ring-primary/30'
      )}
      style={{
        minHeight: `${PAGE_CONFIG.pageHeight}in`,
        padding: `${PAGE_CONFIG.marginTop}in ${PAGE_CONFIG.marginRight}in ${PAGE_CONFIG.marginBottom}in ${PAGE_CONFIG.marginLeft}in`,
      }}
      data-page={pageNumber}
    >
      {/* Page number */}
      <div
        className="absolute text-sm text-muted-foreground"
        style={{
          top: '0.5in',
          right: '0.75in',
        }}
      >
        {formatPageNumber(pageNumber, totalPages)}
      </div>

      {/* Content */}
      <div className="page-content font-mono text-[12pt] leading-relaxed">
        {children}
      </div>

      {/* Page break indicator at bottom */}
      {pageNumber < totalPages && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}
    </div>
  )
}

/**
 * Page navigation controls
 */
function PageNavigator({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
        className="px-2 py-1 text-xs rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ← Prev
      </button>

      {/* Page number input */}
      <input
        type="number"
        min={1}
        max={totalPages}
        value={currentPage}
        onChange={(e) => {
          const page = parseInt(e.target.value, 10)
          if (page >= 1 && page <= totalPages) {
            onPageChange(page)
          }
        }}
        className="w-12 px-2 py-1 text-xs text-center bg-white/5 border border-white/10 rounded"
      />

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        className="px-2 py-1 text-xs rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  )
}
