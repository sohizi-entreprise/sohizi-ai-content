import { Node, mergeAttributes } from "@tiptap/core"
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
import { useSkillAutosave } from "../../hooks/use-autosave"
import { serializeMarkdownWithTextAlign } from "../../extensions/markdown-text-align"
import {
  FileMention,
  createFileMentionSuggestion,
  preprocessFileMentions,
} from "../../extensions/file-mention"
import { ImageLayout } from "../../extensions/image-layout"
import { SlashCommandExtension } from "../../extensions/slash-command"
import { NestedTrailingNode } from "../../extensions/nested-trailing-node"
import { useEditorInputBridge } from "../../bridge/use-editor-input-bridge"
import { MAX_CHARACTER_COUNT } from "../../constants"
import { EditorTopChrome } from "./editor-top-chrome"
import { SkillMetaBadges } from "./skill-meta-badges"
import type { EditorTab, Skill } from "../../types"
import type { JSONContent } from "@tiptap/react"
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

const markdownContentExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
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
  FileMention,
  ImageLayout,
]

const markdownManager = new MarkdownManager({
  extensions: markdownContentExtensions,
  markedOptions: {
    gfm: true,
  },
})

const skillEditorExtensions = [
  SkillDocument,
  SkillDescription,
  SkillSeparator,
  SkillInstruction,
  StarterKit.configure({
    document: false,
    heading: { levels: [1, 2, 3] },
    // Doc-level TrailingNode can't insert into the fixed skill schema; use NestedTrailingNode.
    trailingNode: false,
  }),
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
  Markdown.configure({
    markedOptions: {
      gfm: true,
    },
  }),
  Placeholder.configure({
    includeChildren: true,
    showOnlyCurrent: true,
    placeholder: ({ editor, node, pos }) => {
      if (node.type.name !== "paragraph") return ""

      const $pos = editor.state.doc.resolve(pos)
      for (let depth = $pos.depth; depth >= 0; depth -= 1) {
        const parentNode = $pos.node(depth)
        const nodeName = parentNode.type.name
        const isFirstChild = $pos.index(depth) === 0
        const isSectionEmpty = parentNode.textContent.trim().length === 0

        if (nodeName === "skillDescription" && isFirstChild && isSectionEmpty) {
          return "Describe what this skill does..."
        }
        if (nodeName === "skillInstruction" && isFirstChild && isSectionEmpty) {
          return "Write instructions or use / command..."
        }
      }

      return ""
    },
  }),
  SlashCommandExtension,
]

const skillEditorStyles = `
.tiptap-editor-content [data-type='skill-description'] p.is-empty::before,
.tiptap-editor-content [data-type='skill-description'] p.is-editor-empty::before,
.tiptap-editor-content [data-type='skill-instruction'] p.is-empty::before,
.tiptap-editor-content [data-type='skill-instruction'] p.is-editor-empty::before {
  color: var(--muted-foreground);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
`

interface SkillEditorViewProps {
  tab: EditorTab
  description?: string
  instruction?: string
  status?: Skill["status"]
  visibility?: Skill["visibility"]
}

function createSkillContent({
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

  const preprocessed = preprocessFileMentions(markdown)
  const blocks = markdownManager.parse(preprocessed).content ?? [
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

export function SkillEditorView({
  tab,
  status = "draft",
  visibility = "private",
  ...props
}: SkillEditorViewProps) {
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(
    null,
  )
  const { projectId } = useParams({
    from: "/dashboard/projects/$projectId/editor",
  })
  const saveSkill = useSkillAutosave({
    duration: 2000,
    projectId,
    fileId: tab.id,
  })
  // TipTap does not refresh onUpdate when deps change — always call the latest saver.
  const saveSkillRef = useRef(saveSkill)
  saveSkillRef.current = saveSkill

  const setEditor = useEditorInputBridge((state) => state.setEditor)
  const clearEditor = useEditorInputBridge((state) => state.clearEditor)

  const searchFiles = useFileMentionSearch(projectId)
  const fileMentionSuggestion = useMemo(
    () => createFileMentionSuggestion(searchFiles),
    [searchFiles],
  )

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      ...skillEditorExtensions,
      FileMention.configure({
        HTMLAttributes: {
          class: "file-mention",
        },
        suggestion: fileMentionSuggestion,
      }),
    ],
    content: createSkillContent(props),
    editorProps: {
      attributes: {
        class: "tiptap-editor-content focus:outline-none",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      // Defer JSON/markdown serialization until the autosave debounce fires.
      saveSkillRef.current(() => {
        const json = updatedEditor.getJSON()
        return {
          description: getNodeMarkdown(json, "skillDescription"),
          instructions: getNodeMarkdown(json, "skillInstruction"),
        }
      })
    },
    onCreate: ({ editor: createdEditor }) => {
      setEditor(createdEditor)
    },
    onDestroy: () => {
      clearEditor(editor)
    },
  })

  return (
    <div className="relative flex h-full w-full flex-col bg-surface">
      <style>{skillEditorStyles}</style>
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
            className="[&_.tiptap]:min-h-[420px] [&_.tiptap]:outline-none"
          />
          <TextEditorBubbleMenu
            editor={editor}
            scrollContainer={scrollContainer}
            file={{ id: tab.id, name: tab.name, format: tab.format ?? "skill" }}
          />
        </div>
      </div>
    </div>
  )
}
