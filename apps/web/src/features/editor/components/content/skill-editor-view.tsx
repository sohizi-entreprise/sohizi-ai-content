import { Extension, Node, mergeAttributes } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"
import Placeholder from "@tiptap/extension-placeholder"
import { TableKit } from "@tiptap/extension-table"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import TextAlign from "@tiptap/extension-text-align"
import { Markdown, MarkdownManager } from "@tiptap/markdown"
import { useParams } from "@tanstack/react-router"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { CharacterCount } from "@tiptap/extension-character-count"
import { useMemo, useRef, useState } from "react"
import TextEditorBubbleMenu from "../text-editor-extensions/bubble-menu"
import { useAutoSave } from "../../hooks/use-autosave"
import { usePendingMarkdownChanges } from "../../hooks/use-pending-markdown-changes"
import { serializeMarkdownWithTextAlign } from "../../extensions/markdown-text-align"
import {
  parseSkillDocument,
  serializeSkillDocument,
} from "../../skill-document"
import {
  FileLinkSuggestion,
  createFileLinkSuggestion,
} from "../../extensions/file-link-suggestion"
import { EditorLink } from "../../extensions/editor-link"
import { ImageLayout } from "../../extensions/image-layout"
import { MarkdownHighlight } from "../../extensions/markdown-highlight"
import { SlashCommandExtension } from "../../extensions/slash-command"
import { NestedTrailingNode } from "../../extensions/nested-trailing-node"
import { useEditorInputBridge } from "../../bridge/use-editor-input-bridge"
import { MAX_CHARACTER_COUNT } from "../../constants"
import { EditorTopChrome } from "./editor-top-chrome"
import { MarkdownDiffChangesPanel } from "./markdown-diff-changes-panel"
import { MarkdownPendingChangesBar } from "./markdown-pending-changes-bar"
import { SkillMetaBadges } from "./skill-meta-badges"
import type { EditorTab, Skill } from "../../types"
import type { Editor, JSONContent } from "@tiptap/react"
import { useFileMentionSearch } from "@/hooks/use-file-mention-search"
import "./text-editor.css"

const SkillDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "skillDescription skillSeparator skillInstruction",
})

const SkillDescription = Node.create({
  name: "skillDescription",
  content: "block+",
  isolating: true,

  parseHTML() {
    return [{ tag: 'section[data-type="skill-description"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-type": "skill-description",
        class: "rounded-xl border border-border bg-card px-5 py-4 shadow-sm",
      }),
      [
        "div",
        {
          class:
            "mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground",
          contenteditable: "false",
        },
        "Description",
      ],
      ["div", { class: "skill-description-content" }, 0],
    ]
  },
})

const SkillSeparator = Node.create({
  name: "skillSeparator",
  group: "block",
  atom: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'hr[data-type="skill-separator"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "hr",
      mergeAttributes(HTMLAttributes, {
        "data-type": "skill-separator",
        class: "my-8 border-0 border-t border-border",
      }),
    ]
  },
})

const SkillInstruction = Node.create({
  name: "skillInstruction",
  content: "block+",
  isolating: true,

  parseHTML() {
    return [{ tag: 'section[data-type="skill-instruction"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-type": "skill-instruction",
        class: "min-h-[320px]",
      }),
      0,
    ]
  },
})

// Placeholder decorations are built inside EditorState.apply, while
// `editor.state` still points at the pre-transaction document. A new list
// item can sit past that document's end, and resolving it throws
// "Position out of range", which aborts Enter.
const docsForPlaceholder = new WeakMap<Editor, Editor["state"]["doc"]>()

const PlaceholderDocTracker = Extension.create({
  name: "placeholderDocTracker",
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        state: {
          init(_config, state) {
            docsForPlaceholder.set(editor, state.doc)
            return null
          },
          apply(_tr, value, _oldState, newState) {
            docsForPlaceholder.set(editor, newState.doc)
            return value
          },
        },
      }),
    ]
  },
})

function resolveSkillPos(editor: Editor, pos: number) {
  const doc = docsForPlaceholder.get(editor) ?? editor.state.doc
  if (pos < 0 || pos > doc.content.size) return null
  return doc.resolve(pos)
}

function getSkillSection(editor: Editor, pos: number) {
  const $pos = resolveSkillPos(editor, pos)
  if (!$pos) return null
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const nodeName = $pos.node(depth).type.name
    if (nodeName === "skillDescription" || nodeName === "skillInstruction") {
      return nodeName
    }
  }
  return null
}

function isEmptySkillDescription(editor: Editor, pos: number) {
  const $pos = resolveSkillPos(editor, pos)
  if (!$pos) return false
  for (let depth = $pos.depth; depth >= 0; depth -= 1) {
    const parent = $pos.node(depth)
    if (parent.type.name === "skillDescription") {
      return parent.textContent.trim().length === 0
    }
  }
  return false
}

const markdownContentExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
  TableKit.configure({
    table: {
      resizable: true,
      renderWrapper: true,
      lastColumnResizable: false,
    },
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  EditorLink,
  ImageLayout,
  MarkdownHighlight,
]

const markdownManager = new MarkdownManager({
  extensions: markdownContentExtensions,
  markedOptions: {
    gfm: true,
  },
})

export const skillEditorExtensions = [
  SkillDocument,
  SkillDescription,
  SkillSeparator,
  SkillInstruction,
  StarterKit.configure({
    document: false,
    heading: { levels: [1, 2, 3] },
    // Doc-level TrailingNode can't insert into the fixed skill schema; use NestedTrailingNode.
    trailingNode: false,
    link: false,
  }),
  EditorLink,
  NestedTrailingNode.configure({
    containers: ["skillDescription", "skillInstruction"],
  }),
  TableKit.configure({
    table: {
      resizable: true,
      renderWrapper: true,
      lastColumnResizable: false,
    },
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
    a11y: {
      checkboxLabel: (_node, checked) =>
        checked ? "Mark task as incomplete" : "Mark task as complete",
    },
  }),
  CharacterCount.configure({
    limit: MAX_CHARACTER_COUNT,
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  ImageLayout,
  MarkdownHighlight,
  Markdown.configure({
    markedOptions: {
      gfm: true,
    },
  }),
  // Must be registered before Placeholder so its state field runs first.
  PlaceholderDocTracker,
  Placeholder.configure({
    showOnlyCurrent: false,
    includeChildren: true,
    emptyNodeClass: ({ editor, pos, hasAnchor }) => {
      if (isEmptySkillDescription(editor, pos) || hasAnchor) return "is-empty"
      return ""
    },
    placeholder: ({ editor, node, pos, hasAnchor }) => {
      if (node.type.name !== "paragraph") return ""

      if (isEmptySkillDescription(editor, pos)) {
        return "Describe what this skill does..."
      }

      if (!hasAnchor) return ""

      const section = getSkillSection(editor, pos)
      if (section === "skillInstruction") {
        return "Write instructions or use / command..."
      }

      return "Write something or use / command"
    },
  }),
  SlashCommandExtension,
]

interface SkillEditorViewProps {
  tab: EditorTab
  initialContent?: string
  status?: Skill["status"]
  visibility?: Skill["visibility"]
}

export function createSkillContent({
  description = "",
  instruction = "",
}: {
  description?: string
  instruction?: string
}): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "skillDescription",
        content: markdownToBlocks(description),
      },
      {
        type: "skillSeparator",
      },
      {
        type: "skillInstruction",
        content: markdownToBlocks(instruction),
      },
    ],
  }
}

function markdownToBlocks(markdown: string): Array<JSONContent> {
  if (!markdown.trim()) {
    return [{ type: "paragraph" }]
  }

  const blocks = markdownManager.parse(markdown).content ?? [
    { type: "paragraph" },
  ]

  return blocks.length > 0 ? blocks : [{ type: "paragraph" }]
}

function getNodeMarkdown(doc: JSONContent, nodeType: string) {
  const stack = [doc]

  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue

    if (node.type === nodeType) {
      return blocksToMarkdown(node.content ?? [])
    }

    stack.push(...(node.content ?? []))
  }

  return ""
}

function blocksToMarkdown(blocks: Array<JSONContent>) {
  if (blocks.length === 0) return ""

  return serializeMarkdownWithTextAlign(
    {
      type: "doc",
      content: blocks,
    },
    markdownContentExtensions,
  ).trim()
}

function fieldsFromSkillMarkdown(content: string) {
  const parsed = parseSkillDocument(content)
  if (!parsed) {
    return { description: "", instruction: content }
  }
  return {
    description: parsed.description,
    instruction: parsed.instructions,
  }
}

function skillEditorToMarkdown(editor: Editor) {
  const json = editor.getJSON()
  return serializeSkillDocument({
    description: getNodeMarkdown(json, "skillDescription"),
    instructions: getNodeMarkdown(json, "skillInstruction"),
  })
}

function setSkillMarkdownContent(editor: Editor, markdown: string) {
  editor.commands.setContent(
    createSkillContent(fieldsFromSkillMarkdown(markdown)),
  )
}

export function SkillEditorView({
  tab,
  initialContent = "",
  status = "draft",
  visibility = "private",
}: SkillEditorViewProps) {
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(
    null,
  )
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/editor",
  })
  const baseMarkdown = initialContent
  const appliedDiffRef = useRef(false)
  const isApplyingVisualDiffRef = useRef(false)
  const autosave = useAutoSave({
    duration: 2000,
    projectId,
    fileId: tab.id,
    onSaveComplete: () => {
      appliedDiffRef.current = false
    },
  })

  const setEditor = useEditorInputBridge((state) => state.setEditor)
  const clearEditor = useEditorInputBridge((state) => state.clearEditor)

  const searchFiles = useFileMentionSearch(projectId)
  const fileLinkSuggestion = useMemo(
    () => createFileLinkSuggestion(searchFiles),
    [searchFiles],
  )

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      ...skillEditorExtensions,
      FileLinkSuggestion.configure({
        suggestion: fileLinkSuggestion,
      }),
    ],
    content: createSkillContent(fieldsFromSkillMarkdown(baseMarkdown)),
    editorProps: {
      attributes: {
        class: "tiptap-editor-content focus:outline-none",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      if (isApplyingVisualDiffRef.current) return
      autosave({
        content: skillEditorToMarkdown(updatedEditor),
        diffApplied: appliedDiffRef.current,
      })
    },
    onCreate: ({ editor: createdEditor }) => {
      setEditor(createdEditor)
    },
    onDestroy: () => {
      clearEditor(editor)
    },
  })

  const {
    pendingOperation,
    pendingPatch,
    changeHunks,
    changesOpen,
    setChangesOpen,
    handleAcceptChanges,
    handleRejectChanges,
  } = usePendingMarkdownChanges({
    editor,
    projectId,
    fileId: tab.id,
    baseMarkdown,
    autosave,
    setMarkdownContent: setSkillMarkdownContent,
    getMarkdown: skillEditorToMarkdown,
    appliedDiffRef,
    isApplyingVisualDiffRef,
  })

  return (
    <div className="relative flex h-full w-full flex-col bg-surface">
      <EditorTopChrome editor={editor} tabId={tab.id} />
      <div
        ref={setScrollContainer}
        className="flex-1 overflow-auto overscroll-none"
      >
        <div className="mx-auto min-w-2xl max-w-3xl px-6 pb-8 pt-12">
          <SkillMetaBadges
            projectId={projectId}
            fileId={tab.id}
            status={status}
            visibility={visibility}
          />
          <EditorContent
            editor={editor}
            className="[&_.tiptap]:min-h-105 [&_.tiptap]:outline-none"
          />
          <TextEditorBubbleMenu
            editor={editor}
            scrollContainer={scrollContainer}
            file={{
              id: tab.id,
              name: tab.name,
              format: tab.type ?? tab.format ?? "skill",
              path: tab.path,
            }}
          />
          {pendingOperation && (
            <MarkdownPendingChangesBar
              changesOpen={changesOpen}
              onToggleChanges={() => setChangesOpen((open) => !open)}
              onAccept={handleAcceptChanges}
              onReject={handleRejectChanges}
            />
          )}
        </div>
      </div>
      <MarkdownDiffChangesPanel
        open={Boolean(pendingPatch) && changesOpen}
        onOpenChange={setChangesOpen}
        hunks={changeHunks}
      />
    </div>
  )
}
