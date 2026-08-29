// Render diffs
// Add note
// Add image grid [custom node]
// Add table
// Render mentions
// Render youtube video
// Horizontal rule
import { Mark } from '@tiptap/react'

/**
 *
 */

export const MarkdownHighlight = Mark.create({
  name: 'highlight',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'mark' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', HTMLAttributes, 0]
  },

  addCommands() {
    return {
      toggleHighlight:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name)
        },
    }
  },

  markdownTokenizer: {
    name: 'highlight',
    level: 'inline', // inline element
    // fast hint for the lexer to find candidate positions
    start: (src) => src.indexOf('=='),
    tokenize: (src, _tokens, lexer) => {
      // Match ==text== at the start of the remaining source
      const match = /^==([^=]+)==/.exec(src)
      if (!match) return undefined

      return {
        type: 'highlight', // token type (must match name)
        raw: match[0], // full matched string: ==text==
        text: match[1], // inner content: text
        // Let the Markdown lexer process nested inline formatting
        tokens: lexer.inlineTokens(match[1]),
      }
    },
  },

  // Parse Markdown token to Tiptap JSON
  parseMarkdown: (token, helpers) => {
    // Parse nested inline tokens into Tiptap inline content
    const content = helpers.parseInline(token.tokens || [])
    // Apply the 'highlight' mark to the parsed content
    return helpers.applyMark('highlight', content)
  },

  // Render Tiptap node back to Markdown
  renderMarkdown: (node, helpers) => {
    const content = helpers.renderChildren(node.content || [])
    // Wrap serialized children in == delimiters
    return `==${content}==`
  },
})
