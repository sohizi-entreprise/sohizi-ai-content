import { Node, mergeAttributes } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { Markdown, MarkdownManager } from '@tiptap/markdown'
import { useParams } from '@tanstack/react-router'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useMemo } from 'react'
import TextEditorBubbleMenu from '../text-editor-extensions/bubble-menu'
import { useSkillAutosave } from '../../hooks/use-autosave'
import { serializeMarkdownWithTextAlign } from '../../extensions/markdown-text-align'
import {
  PatchAdditionMark,
  PatchDeletionMark,
} from '../../extensions/patch-diff'
import {
  FileMention,
  createFileMentionSuggestion,
  preprocessFileMentions,
} from '../../extensions/file-mention'
import { ImageLayout } from '../../extensions/image-layout'
import TextEditorToolbar from './text-editor-toolbar'
import type { EditorTab } from '../../types'
import type { JSONContent } from '@tiptap/react'
import { useFileMentionSearch } from '@/hooks/use-file-mention-search'
import './text-editor.css'

const SkillDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'skillDescription skillSeparator skillInstruction',
})

const SkillDescription = Node.create({
  name: 'skillDescription',
  content: 'block+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'section[data-type="skill-description"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'skill-description',
        class: 'rounded-xl border border-border bg-card/35 px-5 py-4 shadow-sm',
      }),
      [
        'div',
        {
          class:
            'mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground',
          contenteditable: 'false',
        },
        'Description',
      ],
      ['div', { class: 'skill-description-content' }, 0],
    ]
  },
})

const SkillSeparator = Node.create({
  name: 'skillSeparator',
  group: 'block',
  atom: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'hr[data-type="skill-separator"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'hr',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'skill-separator',
        class: 'my-8 border-0 border-t border-border',
      }),
    ]
  },
})

const SkillInstruction = Node.create({
  name: 'skillInstruction',
  content: 'block+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'section[data-type="skill-instruction"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'skill-instruction',
        class: 'min-h-[320px]',
      }),
      0,
    ]
  },
})

const markdownContentExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  PatchAdditionMark,
  PatchDeletionMark,
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
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  PatchAdditionMark,
  PatchDeletionMark,
  ImageLayout,
  Markdown.configure({
    markedOptions: {
      gfm: true,
    },
  }),
  Placeholder.configure({
    includeChildren: true,
    showOnlyCurrent: false,
    placeholder: ({ editor, node, pos }) => {
      if (node.type.name !== 'paragraph') return ''

      const $pos = editor.state.doc.resolve(pos)
      for (let depth = $pos.depth; depth >= 0; depth -= 1) {
        const parentNode = $pos.node(depth)
        const nodeName = parentNode.type.name
        const isFirstChild = $pos.index(depth) === 0
        const isSectionEmpty = parentNode.textContent.trim().length === 0

        if (nodeName === 'skillDescription' && isFirstChild && isSectionEmpty) {
          return 'Describe what this skill does...'
        }
        if (nodeName === 'skillInstruction' && isFirstChild && isSectionEmpty) {
          return 'Write instructions...'
        }
      }

      return ''
    },
  }),
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
}

type SkillEditorContent = Omit<SkillEditorViewProps, 'tab'>

function createSkillContent({
  description = '',
  instruction = '',
}: SkillEditorContent): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'skillDescription',
        content: markdownToBlocks(description),
      },
      {
        type: 'skillSeparator',
      },
      {
        type: 'skillInstruction',
        content: markdownToBlocks(instruction),
      },
    ],
  }
}

function markdownToBlocks(markdown: string): Array<JSONContent> {
  if (!markdown.trim()) {
    return [{ type: 'paragraph' }]
  }

  const preprocessed = preprocessFileMentions(markdown)
  const blocks = markdownManager.parse(preprocessed).content ?? [
    { type: 'paragraph' },
  ]

  return blocks.length > 0 ? blocks : [{ type: 'paragraph' }]
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

  return ''
}

function blocksToMarkdown(blocks: Array<JSONContent>) {
  if (blocks.length === 0) return ''

  return serializeMarkdownWithTextAlign(
    {
      type: 'doc',
      content: blocks,
    },
    markdownContentExtensions,
  ).trim()
}

export function SkillEditorView({ tab, ...props }: SkillEditorViewProps) {
  const { projectId } = useParams({
    from: '/dashboard/projects/$projectId/editor',
  })
  const saveSkill = useSkillAutosave({
    duration: 2000,
    projectId,
    fileId: tab.id,
  })

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
          class: 'file-mention',
        },
        suggestion: fileMentionSuggestion,
      }),
    ],
    content: createSkillContent(props),
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content focus:outline-none',
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const json = updatedEditor.getJSON()
      const skill = {
        description: getNodeMarkdown(json, 'skillDescription'),
        instruction: getNodeMarkdown(json, 'skillInstruction'),
      }

      console.log(skill)
      saveSkill({
        description: skill.description,
        instructions: skill.instruction,
      })
    },
  })

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <style>{skillEditorStyles}</style>
      <TextEditorToolbar editor={editor} tabId={tab.id} />
      <div className="flex-1 overflow-auto overscroll-none">
        <div className="mx-auto min-w-2xl max-w-3xl px-6 py-8">
          <EditorContent
            editor={editor}
            className="[&_.tiptap]:min-h-[420px] [&_.tiptap]:outline-none"
          />
          <TextEditorBubbleMenu
            editor={editor}
            file={{ id: tab.id, name: tab.name }}
          />
        </div>
      </div>
    </div>
  )
}
