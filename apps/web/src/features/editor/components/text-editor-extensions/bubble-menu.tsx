import { computePosition, flip, offset, shift } from "@floating-ui/dom"
import { NodeSelection } from "@tiptap/pm/state"
import { useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { Button } from "@sohizi/ui/button"
import { ColibriMascot } from "@sohizi/ui/colibri-mascot"
import { Separator } from "@sohizi/ui/separator"
import { useEditorInputBridge } from "../../bridge/use-editor-input-bridge"
import { useEditorStore } from "../../stores/editor-store"
import TextEditorToolbar from "../content/text-editor-toolbar"
import type { Editor } from "@tiptap/react"
import type { AttachedSelection } from "@/features/chat/types"
import { buildAttachedSelection } from "@/features/chat/lib/editor-context"

const BUBBLE_MENU_PLUGIN_KEY = "textEditorBubbleMenu"

type TextEditorBubbleMenuProps = {
  editor: Editor
  scrollContainer: HTMLElement | null
  file: {
    id: string
    name: string
    format: string
    path: string
  }
}

export type AtomicSelectionState = {
  text: string
  from: number
  to: number
  selectionStart?: number
  selectionEnd?: number
  getRect: () => DOMRect
  clear: () => void
}

const TEXT_FIELD_MIRROR_STYLES = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
] as const

/**
 * Measure the selected substring inside an input/textarea so floating UI can
 * anchor next to the highlight instead of the whole control.
 */
export function getTextFieldSelectionRect(
  element: HTMLInputElement | HTMLTextAreaElement,
): DOMRect {
  const start = element.selectionStart
  const end = element.selectionEnd
  const fieldRect = element.getBoundingClientRect()

  if (
    typeof document === "undefined" ||
    start == null ||
    end == null ||
    start >= end
  ) {
    return fieldRect
  }

  const isInput = element instanceof HTMLInputElement
  const computed = window.getComputedStyle(element)
  const mirror = document.createElement("div")

  for (const prop of TEXT_FIELD_MIRROR_STYLES) {
    mirror.style.setProperty(
      prop.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`),
      computed.getPropertyValue(
        prop.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`),
      ),
    )
  }

  mirror.style.position = "fixed"
  mirror.style.visibility = "hidden"
  mirror.style.pointerEvents = "none"
  mirror.style.top = "0"
  mirror.style.left = "0"
  mirror.style.transform = "none"
  mirror.style.whiteSpace = isInput ? "pre" : "pre-wrap"
  mirror.style.overflow = "hidden"
  mirror.style.width = `${element.offsetWidth}px`
  if (isInput) {
    mirror.style.height = "auto"
  } else {
    mirror.style.height = `${element.offsetHeight}px`
    mirror.style.overflow = "auto"
  }

  const value = element.value
  mirror.append(document.createTextNode(value.slice(0, start)))
  const mark = document.createElement("span")
  mark.textContent = value.slice(start, end) || "\u200b"
  mirror.append(mark)
  if (!isInput) {
    mirror.append(document.createTextNode(value.slice(end)))
  }

  document.body.appendChild(mirror)
  mirror.scrollTop = element.scrollTop
  mirror.scrollLeft = element.scrollLeft

  const markRect = mark.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  document.body.removeChild(mirror)

  const left = fieldRect.left + (markRect.left - mirrorRect.left)
  const top = fieldRect.top + (markRect.top - mirrorRect.top)
  const width = Math.max(markRect.width, 1)
  const height = Math.max(markRect.height, 1)

  // Keep the anchor inside the visible field when the selection is scrolled away.
  const clampedLeft = Math.min(
    Math.max(left, fieldRect.left),
    Math.max(fieldRect.left, fieldRect.right - width),
  )
  const clampedTop = Math.min(
    Math.max(top, fieldRect.top),
    Math.max(fieldRect.top, fieldRect.bottom - height),
  )

  return new DOMRect(clampedLeft, clampedTop, width, height)
}

function getElementFromNode(node: Node | null): Element | null {
  if (!node) return null
  return node instanceof Element ? node : node.parentElement
}

export function isAtomicDomNode(
  element: Element,
  editorDom: HTMLElement,
): boolean {
  if (!editorDom.contains(element)) return false

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return true
  }

  let current: Element | null = element
  while (current && current !== editorDom) {
    if (current.getAttribute("data-node-view-content") !== null) {
      return false
    }
    if (
      current.getAttribute("contenteditable") === "false" ||
      current.getAttribute("data-node-view-wrapper") !== null
    ) {
      return true
    }
    current = current.parentElement
  }
  return false
}

export function isAtomicEditorSelection(editor: Editor): boolean {
  const { selection } = editor.state
  if (selection instanceof NodeSelection) {
    return selection.node.isAtom
  }
  const { $from, $to } = selection
  if ($from.parent.isAtom || $to.parent.isAtom) {
    return true
  }
  // Text nodes are atoms in ProseMirror. Selecting a whole heading/paragraph
  // often matches exactly one text node — that must still show the full toolbar.
  const nodeAfter = $from.nodeAfter
  if (
    nodeAfter &&
    !nodeAfter.isText &&
    nodeAfter.isAtom &&
    selection.to === selection.from + nodeAfter.nodeSize
  ) {
    return true
  }
  return false
}

function resolveDomNodeDocRange(
  editor: Editor,
  element: Element,
): { from: number; to: number } {
  const editorDom = editor.view.dom
  const docSize = editor.state.doc.content.size

  const wrapper =
    element.closest("[data-node-view-wrapper]") ??
    element.closest('[contenteditable="false"]') ??
    element

  if (editorDom.contains(wrapper)) {
    try {
      const pos = editor.view.posAtDOM(wrapper, 0)
      const clampedPos = Math.max(0, Math.min(pos, docSize))
      const $pos = editor.state.doc.resolve(clampedPos)
      if ($pos.nodeAfter) {
        return {
          from: clampedPos,
          to: Math.min(docSize, clampedPos + $pos.nodeAfter.nodeSize),
        }
      }
      if ($pos.nodeBefore) {
        return {
          from: Math.max(0, clampedPos - $pos.nodeBefore.nodeSize),
          to: clampedPos,
        }
      }
      if ($pos.depth > 0) {
        return {
          from: $pos.before($pos.depth),
          to: $pos.after($pos.depth),
        }
      }
      return { from: clampedPos, to: clampedPos }
    } catch {
      // Fall back to current editor selection below
    }
  }

  const { from, to } = editor.state.selection
  return {
    from: Math.max(0, Math.min(from, docSize)),
    to: Math.max(0, Math.min(to, docSize)),
  }
}

export function detectAtomicSelection(
  editor: Editor,
): AtomicSelectionState | null {
  if (editor.isDestroyed) return null
  const editorDom = editor.view.dom

  const activeEl = document.activeElement
  if (
    (activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement) &&
    isAtomicDomNode(activeEl, editorDom)
  ) {
    let start: number | null = null
    let end: number | null = null
    try {
      start = activeEl.selectionStart
      end = activeEl.selectionEnd
    } catch {
      start = null
      end = null
    }
    if (typeof start === "number" && typeof end === "number" && start < end) {
      const text = activeEl.value.slice(start, end)
      if (text.trim().length > 0) {
        const { from, to } = resolveDomNodeDocRange(editor, activeEl)
        return {
          text,
          from,
          to,
          selectionStart: start,
          selectionEnd: end,
          getRect: () => getTextFieldSelectionRect(activeEl),
          clear: () => {
            try {
              activeEl.setSelectionRange(end, end)
            } catch {
              // ignore unsupported input types
            }
          },
        }
      }
    }
  }

  const domSelection =
    typeof window !== "undefined" ? window.getSelection() : null
  if (
    domSelection &&
    domSelection.rangeCount > 0 &&
    !domSelection.isCollapsed
  ) {
    const text = domSelection.toString()
    if (text.trim().length > 0) {
      const range = domSelection.getRangeAt(0)
      const anchorEl = getElementFromNode(domSelection.anchorNode)
      const focusEl = getElementFromNode(domSelection.focusNode)
      if (
        anchorEl &&
        focusEl &&
        editorDom.contains(anchorEl) &&
        editorDom.contains(focusEl) &&
        (isAtomicDomNode(anchorEl, editorDom) ||
          isAtomicDomNode(focusEl, editorDom))
      ) {
        const { from, to } = resolveDomNodeDocRange(editor, anchorEl)
        return {
          text,
          from,
          to,
          getRect: () => {
            const rect = range.getBoundingClientRect()
            if (rect.width === 0 && rect.height === 0) {
              return anchorEl.getBoundingClientRect()
            }
            return rect
          },
          clear: () => {
            domSelection.removeAllRanges()
          },
        }
      }
    }
  }

  return null
}

function FeedKoliButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-7 shrink-0 gap-1.5 rounded-xl px-2 text-xs font-medium text-primary hover:text-primary cursor-pointer"
    >
      <ColibriMascot state="idle" size={20} decorative />
      <span>Feed Koli</span>
    </Button>
  )
}

export default function TextEditorBubbleMenu({
  editor,
  scrollContainer,
  file,
}: TextEditorBubbleMenuProps) {
  const isSuppressedRef = useRef(false)
  const [menuContainer, setMenuContainer] = useState<HTMLElement | null>(null)
  const [atomicSelection, setAtomicSelection] =
    useState<AtomicSelectionState | null>(null)
  const atomicSelectionRef = useRef<AtomicSelectionState | null>(null)
  const atomicMenuRef = useRef<HTMLDivElement | null>(null)
  const runCommand = useEditorInputBridge((state) => state.runCommand)

  const { isSelectionEmpty, isAtomicProseMirrorSelection } = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      isSelectionEmpty: currentEditor.state.selection.empty,
      isAtomicProseMirrorSelection: isAtomicEditorSelection(currentEditor),
    }),
  })

  const syncAtomicSelection = useCallback(() => {
    if (editor.isDestroyed) return
    const next = detectAtomicSelection(editor)
    atomicSelectionRef.current = next
    setAtomicSelection((prev) => {
      if (!prev && !next) return prev
      if (
        prev &&
        next &&
        prev.text === next.text &&
        prev.from === next.from &&
        prev.to === next.to &&
        prev.selectionStart === next.selectionStart &&
        prev.selectionEnd === next.selectionEnd
      ) {
        return prev
      }
      return next
    })
    const activeEl = document.activeElement
    const focusMovedToInnerControl =
      activeEl !== null &&
      activeEl !== editor.view.dom &&
      editor.view.dom.contains(activeEl)
    if (next || focusMovedToInnerControl) {
      editor.view.dispatch(
        editor.state.tr.setMeta(BUBBLE_MENU_PLUGIN_KEY, "hide"),
      )
    }
  }, [editor])

  useEffect(() => {
    // Only clear suppress on focus. selectionUpdate also fires when Feed Koli
    // collapses the selection, which would immediately re-show the menu.
    const clearSuppress = () => {
      isSuppressedRef.current = false
    }

    editor.on("focus", clearSuppress)

    return () => {
      editor.off("focus", clearSuppress)
    }
  }, [editor])

  useEffect(() => {
    if (editor.isDestroyed) return
    const editorDom = editor.view.dom

    const handleCheck = () => {
      queueMicrotask(syncAtomicSelection)
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (
        atomicMenuRef.current &&
        event.target instanceof Node &&
        atomicMenuRef.current.contains(event.target)
      ) {
        return
      }
      handleCheck()
    }

    document.addEventListener("selectionchange", handleCheck)
    document.addEventListener("mousedown", handleMouseDown)
    editorDom.addEventListener("mouseup", handleCheck)
    editorDom.addEventListener("keyup", handleCheck)
    editorDom.addEventListener("select", handleCheck, true)
    editorDom.addEventListener("focusout", handleCheck)

    return () => {
      document.removeEventListener("selectionchange", handleCheck)
      document.removeEventListener("mousedown", handleMouseDown)
      editorDom.removeEventListener("mouseup", handleCheck)
      editorDom.removeEventListener("keyup", handleCheck)
      editorDom.removeEventListener("select", handleCheck, true)
      editorDom.removeEventListener("focusout", handleCheck)
    }
  }, [editor, syncAtomicSelection])

  useLayoutEffect(() => {
    const floatingEl = atomicMenuRef.current
    if (!atomicSelection || !floatingEl) return

    const updatePosition = () => {
      const rect = atomicSelection.getRect()
      const virtualEl = {
        getBoundingClientRect: () => rect,
        getClientRects: () => [rect],
      }

      void computePosition(virtualEl, floatingEl, {
        strategy: "fixed",
        placement: "bottom",
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        if (!floatingEl.isConnected) return
        floatingEl.style.left = `${x}px`
        floatingEl.style.top = `${y}px`
      })
    }

    const initialRect = atomicSelection.getRect()
    floatingEl.style.left = `${initialRect.left}px`
    floatingEl.style.top = `${initialRect.bottom + 8}px`
    updatePosition()

    const scrollTarget = scrollContainer ?? window
    window.addEventListener("resize", updatePosition)
    scrollTarget.addEventListener("scroll", updatePosition, { passive: true })
    return () => {
      window.removeEventListener("resize", updatePosition)
      scrollTarget.removeEventListener("scroll", updatePosition)
    }
  }, [atomicSelection, scrollContainer])

  const sendSelectionToChat = (selection: AttachedSelection) => {
    const dispatchMention = () => {
      runCommand({
        type: "insertMention",
        mention: {
          displayName: file.name,
          path: file.path,
          selection,
        },
      })
    }

    const { chatOpenByContext, toggleChatPanel } = useEditorStore.getState()
    if (!chatOpenByContext["file-system"]) {
      toggleChatPanel("file-system")
      if (!useEditorInputBridge.getState().chatEditor) {
        window.setTimeout(dispatchMention, 80)
        return
      }
    }
    dispatchMention()
  }

  const handleAddContext = () => {
    const { from, to } = editor.state.selection
    const selection = buildAttachedSelection({ editor, file, from, to })
    if (!selection) return

    isSuppressedRef.current = true
    sendSelectionToChat(selection)

    // mousedown on the bubble sets TipTap preventHide, so blur alone won't hide it.
    editor.view.dispatch(
      editor.state.tr.setMeta(BUBBLE_MENU_PLUGIN_KEY, "hide"),
    )
  }

  const handleAtomicAddContext = () => {
    const current = atomicSelectionRef.current ?? atomicSelection
    if (!current) return

    const selection = buildAttachedSelection({
      editor,
      file,
      from: current.from,
      to: current.to,
      selectedText: current.text,
    })
    if (!selection) return

    current.clear()
    atomicSelectionRef.current = null
    setAtomicSelection(null)
    sendSelectionToChat(selection)
  }

  return (
    <>
      <BubbleMenu
        pluginKey={BUBBLE_MENU_PLUGIN_KEY}
        editor={editor}
        resizeDelay={16}
        options={{
          placement: "bottom",
          offset: 8,
          flip: true,
          scrollTarget: scrollContainer ?? window,
        }}
        shouldShow={({ editor: currentEditor, element }) => {
          if (isSuppressedRef.current) return false
          if (
            atomicSelectionRef.current ||
            detectAtomicSelection(currentEditor) !== null
          ) {
            return false
          }

          if (isAtomicEditorSelection(currentEditor)) {
            const { from, to } = currentEditor.state.selection
            const hasNodeText =
              currentEditor.state.doc.textBetween(from, to, "\n").trim()
                .length > 0
            if (!hasNodeText) return false
            const menuHasFocus = element.contains(document.activeElement)
            return currentEditor.isFocused || menuHasFocus
          }

          const inTable =
            currentEditor.isActive("tableCell") ||
            currentEditor.isActive("tableHeader")
          const hasSelection = !currentEditor.state.selection.empty || inTable
          if (!hasSelection) return false

          // TipTap hides on blur unless focus stays inside the bubble element.
          // Dropdowns portal into `menuContainer` (inside this element) so focus
          // inside a submenu still counts as "in the menu".
          const menuHasFocus = element.contains(document.activeElement)
          return currentEditor.isFocused || menuHasFocus
        }}
      >
        <div
          ref={setMenuContainer}
          data-editor-bubble-menu
          className="flex max-w-[min(100vw-2rem,42rem)] items-center gap-1 rounded-2xl border bg-card/95 px-1.5 py-1 shadow-lg backdrop-blur-md dark:bg-background"
          onMouseDown={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("[data-slot='dialog-content']")
            ) {
              return
            }
            event.preventDefault()
          }}
        >
          {isAtomicProseMirrorSelection ? (
            <FeedKoliButton onClick={handleAddContext} />
          ) : (
            <>
              {!isSelectionEmpty && (
                <>
                  <FeedKoliButton onClick={handleAddContext} />
                  <Separator orientation="vertical" className="mx-0.5 h-5!" />
                </>
              )}
              <TextEditorToolbar
                editor={editor}
                bare
                portalContainer={menuContainer}
                className="min-w-0 flex-1"
              />
            </>
          )}
        </div>
      </BubbleMenu>

      {atomicSelection &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={atomicMenuRef}
            data-editor-bubble-menu
            data-atomic-bubble-menu
            style={{ position: "fixed", zIndex: 50 }}
            className="flex max-w-[min(100vw-2rem,42rem)] items-center gap-1 rounded-2xl border bg-card/95 px-1.5 py-1 shadow-lg backdrop-blur-md dark:bg-background"
            onMouseDown={(event) => {
              event.preventDefault()
            }}
          >
            <FeedKoliButton onClick={handleAtomicAddContext} />
          </div>,
          document.body,
        )}
    </>
  )
}
