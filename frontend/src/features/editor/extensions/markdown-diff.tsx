import {
  Mark,
  Node,
  markInputRule,
  markPasteRule,
  mergeAttributes,
} from '@tiptap/react'
import type { MarkdownToken } from '@tiptap/core'

// Input/paste rules may match anywhere in the document.
const ADDITION_DIFF_REGEX = /\{\+([\s\S]+?)\+\}/
const ADDITION_DIFF_PASTE_REGEX = /\{\+([\s\S]+?)\+\}/g

const DELETION_DIFF_REGEX = /\[-([\s\S]+?)-\]/
const DELETION_DIFF_PASTE_REGEX = /\[-([\s\S]+?)-\]/g

// Tokenizers only receive the suffix starting at the marker (see `start`).
const ADDITION_DIFF_TOKEN_REGEX = /^\{\+([\s\S]+?)\+\}/
const DELETION_DIFF_TOKEN_REGEX = /^\[-([\s\S]+?)-\]/

// Whole-line (block) wrappers — inner markdown is parsed with the block lexer.
// The inner group cannot skip past an earlier closer; `{+**+}word{+**+}` must
// fail here so each pair is handled by the inline tokenizer.
const ADDITION_DIFF_BLOCK_TOKEN_REGEX = /^\{\+((?:(?!\+})[\s\S])*?)\+\}(?:\n|$)/
const DELETION_DIFF_BLOCK_TOKEN_REGEX = /^\[-((?:(?!-\])[\s\S])*?)-\](?:\n|$)/

const DIFF_BLOCK_START_REGEX = /^(?:\[-|\{\+)/

/**
 * Structural markdown that should use a block diff wrapper.
 * Emphasis (`*`, `**`, `_`) is inline — treating it as a block lets
 * `{+**+}word{+**+}` backtrack onto the last closer and parse as
 * bold wrapping leftover `+}word{+`.
 */
const DIFF_BLOCK_INNER_START_REGEX =
  /^(?:#{1,6}\s|(?:[-+*]|\d+\.)\s|>|\s*(?:```|~~~)|<|\||(?:-{3,}|\*{3,}|_{3,})\s*$)/

function blockDiffStart(src: string) {
  return DIFF_BLOCK_START_REGEX.test(src) ? 0 : -1
}

function shouldParseDiffAsBlock(inner: string) {
  const trimmed = inner.trimStart()
  if (!trimmed) return false
  if (trimmed.includes('\n')) return true
  return DIFF_BLOCK_INNER_START_REGEX.test(trimmed)
}

function tokenizeBlockDiff(
  src: string,
  lexer: { blockTokens: (src: string) => Array<MarkdownToken> },
  tokenRegex: RegExp,
  tokenType: string,
) {
  const match = tokenRegex.exec(src)
  if (!match) return undefined

  const inner = match[1].trim()
  if (!inner || !shouldParseDiffAsBlock(inner)) return undefined

  return {
    type: tokenType,
    raw: match[0],
    text: inner,
    tokens: lexer.blockTokens(`${inner}\n\n`),
  }
}

const AdditionDiffMark = Mark.create({
  name: 'additionDiff',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'mark[data-addition-diff]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-addition-diff': '',
        class: 'bg-green-200 text-green-800 text-medium',
      }),
      0,
    ]
  },

  markdownTokenizer: {
    name: 'additionDiff',
    level: 'inline',
    start: (src) => src.indexOf('{+'),
    tokenize: (src, _tokens, lexer) => {
      const match = ADDITION_DIFF_TOKEN_REGEX.exec(src)
      if (!match) return undefined

      return {
        type: 'additionDiff',
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1]),
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    const content = token.tokens?.length
      ? helpers.parseInline(token.tokens)
      : [helpers.createTextNode(token.text || '')]
    return helpers.applyMark('additionDiff', content)
  },

  renderMarkdown: (node, helpers) => {
    const content = helpers.renderChildren(node.content || [])
    return `{+${content}+}`
  },

  addInputRules() {
    return [
      markInputRule({
        find: ADDITION_DIFF_REGEX,
        type: this.type,
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: ADDITION_DIFF_PASTE_REGEX,
        type: this.type,
      }),
    ]
  },
})

const DeletionDiffMark = Mark.create({
  name: 'deletionDiff',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'mark[data-deletion-diff]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-deletion-diff': '',
        class: 'text-red-400 line-through bg-transparent',
      }),
      0,
    ]
  },

  markdownTokenizer: {
    name: 'deletionDiff',
    level: 'inline',
    start: (src) => src.indexOf('[-'),
    tokenize: (src, _tokens, lexer) => {
      const match = DELETION_DIFF_TOKEN_REGEX.exec(src)
      if (!match) return undefined

      return {
        type: 'deletionDiff',
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1]),
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    const content = token.tokens?.length
      ? helpers.parseInline(token.tokens)
      : [helpers.createTextNode(token.text || '')]
    return helpers.applyMark('deletionDiff', content)
  },

  renderMarkdown: (node, helpers) => {
    const content = helpers.renderChildren(node.content || [])
    return `[-${content}-]`
  },

  addInputRules() {
    return [
      markInputRule({
        find: DELETION_DIFF_REGEX,
        type: this.type,
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: DELETION_DIFF_PASTE_REGEX,
        type: this.type,
      }),
    ]
  },
})

const AdditionDiffBlock = Node.create({
  name: 'additionDiffBlock',
  group: 'block',
  content: 'block+',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-addition-diff-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-addition-diff-block': '',
        class: 'diff-block diff-block-addition',
      }),
      0,
    ]
  },

  markdownTokenizer: {
    name: 'additionDiffBlock',
    level: 'block',
    start: blockDiffStart,
    tokenize: (src, _tokens, lexer) =>
      tokenizeBlockDiff(
        src,
        lexer,
        ADDITION_DIFF_BLOCK_TOKEN_REGEX,
        'additionDiffBlock',
      ),
  },

  parseMarkdown: (token, helpers) => ({
    type: 'additionDiffBlock',
    content: helpers.parseChildren(token.tokens || []),
  }),

  renderMarkdown: (node, helpers) => {
    // Join child blocks with a blank line so headings, tables and paragraphs
    // keep their separation. Without an explicit separator they are glued
    // together (e.g. `## Identity| A | B |`), corrupting multi-block diffs.
    const content = helpers.renderChildren(node.content || [], '\n\n').trim()
    return `{+${content}+}\n\n`
  },
})

const DeletionDiffBlock = Node.create({
  name: 'deletionDiffBlock',
  group: 'block',
  content: 'block+',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-deletion-diff-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-deletion-diff-block': '',
        class: 'diff-block diff-block-deletion',
      }),
      0,
    ]
  },

  markdownTokenizer: {
    name: 'deletionDiffBlock',
    level: 'block',
    start: blockDiffStart,
    tokenize: (src, _tokens, lexer) =>
      tokenizeBlockDiff(
        src,
        lexer,
        DELETION_DIFF_BLOCK_TOKEN_REGEX,
        'deletionDiffBlock',
      ),
  },

  parseMarkdown: (token, helpers) => ({
    type: 'deletionDiffBlock',
    content: helpers.parseChildren(token.tokens || []),
  }),

  renderMarkdown: (node, helpers) => {
    // Join child blocks with a blank line so headings, tables and paragraphs
    // keep their separation. Without an explicit separator they are glued
    // together (e.g. `## Identity| A | B |`), corrupting multi-block diffs.
    const content = helpers.renderChildren(node.content || [], '\n\n').trim()
    return `[-${content}-]\n\n`
  },
})

/** Inline diff marks (phrases) + block wrappers (headings, lists, …). */
export const MarkdownDiffExtensions = [
  AdditionDiffMark,
  DeletionDiffMark,
  AdditionDiffBlock,
  DeletionDiffBlock,
]
