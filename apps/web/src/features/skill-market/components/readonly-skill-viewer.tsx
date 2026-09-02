import { Node, mergeAttributes } from "@tiptap/core"
import { TableKit } from "@tiptap/extension-table"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import TextAlign from "@tiptap/extension-text-align"
import { Markdown, MarkdownManager } from "@tiptap/markdown"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import type { JSONContent } from "@tiptap/react"
import {
  FileMention,
  preprocessFileMentions,
} from "@/features/editor/extensions/file-mention"
import { ImageLayout } from "@/features/editor/extensions/image-layout"
import "@/features/editor/components/content/text-editor.css"

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
        class: "rounded-xl border border-border bg-card/35 px-5 py-4 shadow-sm",
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
      resizable: false,
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

const skillViewerExtensions = [
  SkillDocument,
  SkillDescription,
  SkillSeparator,
  SkillInstruction,
  StarterKit.configure({
    document: false,
    heading: { levels: [1, 2, 3] },
  }),
  TableKit.configure({
    table: {
      resizable: false,
      renderWrapper: true,
      lastColumnResizable: false,
    },
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  ImageLayout,
  FileMention.configure({
    HTMLAttributes: {
      class: "file-mention",
    },
    enableClick: false,
  }),
  Markdown.configure({
    markedOptions: {
      gfm: true,
    },
  }),
]

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

function createSkillContent(
  description: string,
  instruction: string,
): JSONContent {
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

type ReadonlySkillViewerProps = {
  description: string
  instructions: string
}

export function ReadonlySkillViewer({
  description,
  instructions,
}: ReadonlySkillViewerProps) {
  const editor = useEditor({
    immediatelyRender: true,
    editable: false,
    extensions: skillViewerExtensions,
    content: createSkillContent(description, instructions),
    editorProps: {
      attributes: {
        class: "tiptap-editor-content focus:outline-none",
      },
    },
  })

  return (
    <div className="mx-auto min-w-0 max-w-3xl px-6 pb-10 pt-4">
      <EditorContent
        editor={editor}
        className="[&_.tiptap]:min-h-[320px] [&_.tiptap]:outline-none"
      />
    </div>
  )
}
