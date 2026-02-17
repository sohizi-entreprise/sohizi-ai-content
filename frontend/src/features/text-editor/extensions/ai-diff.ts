import { Mark, mergeAttributes, markInputRule, markPasteRule } from '@tiptap/core'

export interface AIDiffOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiDiff: {
      setAIAddition: (attributes?: { suggestionId?: string }) => ReturnType
      setAIDeletion: (attributes?: { suggestionId?: string }) => ReturnType
      unsetAIDiff: () => ReturnType
    }
    aiAddition: {
      setAIAddition: (attributes?: { suggestionId?: string }) => ReturnType
      unsetAIAddition: () => ReturnType
    }
    aiDeletion: {
      setAIDeletion: (attributes?: { suggestionId?: string }) => ReturnType
      unsetAIDeletion: () => ReturnType
    }
  }
}

// Input rule regex for {{...}} (AI additions - green)
const additionInputRegex = /\{\{([^}]+)\}\}$/
const additionPasteRegex = /\{\{([^}]+)\}\}/g

// Input rule regex for [[...]] (AI deletions - red strikethrough)
const deletionInputRegex = /\[\[([^\]]+)\]\]$/
const deletionPasteRegex = /\[\[([^\]]+)\]\]/g

// Mark for AI additions (green highlight) - wrapped in {{...}}
export const AIAdditionMark = Mark.create({
  name: 'aiAddition',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-suggestion-id'),
        renderHTML: (attributes) => {
          if (!attributes.suggestionId) return {}
          return { 'data-suggestion-id': attributes.suggestionId }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-ai-diff="addition"]',
      },
      {
        tag: 'ins.ai-diff-addition',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'ins',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-ai-diff': 'addition',
        class: 'ai-diff-addition',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setAIAddition:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      unsetAIAddition:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },

  addInputRules() {
    return [
      markInputRule({
        find: additionInputRegex,
        type: this.type,
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: additionPasteRegex,
        type: this.type,
      }),
    ]
  },
})

// Mark for AI deletions (red strikethrough) - wrapped in [[...]]
export const AIDeletionMark = Mark.create({
  name: 'aiDeletion',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-suggestion-id'),
        renderHTML: (attributes) => {
          if (!attributes.suggestionId) return {}
          return { 'data-suggestion-id': attributes.suggestionId }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-ai-diff="deletion"]',
      },
      {
        tag: 'del.ai-diff-deletion',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'del',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-ai-diff': 'deletion',
        class: 'ai-diff-deletion',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setAIDeletion:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      unsetAIDeletion:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },

  addInputRules() {
    return [
      markInputRule({
        find: deletionInputRegex,
        type: this.type,
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: deletionPasteRegex,
        type: this.type,
      }),
    ]
  },
})

// Combined extension that includes both marks
export const AIDiffExtension = Mark.create<AIDiffOptions>({
  name: 'aiDiff',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      type: {
        default: 'addition',
        parseHTML: (element) => element.getAttribute('data-ai-diff'),
        renderHTML: (attributes) => {
          return { 'data-ai-diff': attributes.type }
        },
      },
      suggestionId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-suggestion-id'),
        renderHTML: (attributes) => {
          if (!attributes.suggestionId) return {}
          return { 'data-suggestion-id': attributes.suggestionId }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-ai-diff]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-ai-diff'] || 'addition'
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: type === 'deletion' ? 'ai-diff-deletion' : 'ai-diff-addition',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setAIAddition:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, { type: 'addition', ...attributes })
        },
      setAIDeletion:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, { type: 'deletion', ...attributes })
        },
      unsetAIDiff:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})
