import { Mark, mergeAttributes, markInputRule, markPasteRule } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    patchAddition: {
      setPatchAddition: () => ReturnType
      unsetPatchAddition: () => ReturnType
    }
    patchDeletion: {
      setPatchDeletion: () => ReturnType
      unsetPatchDeletion: () => ReturnType
    }
  }
}

const additionInputRegex = /\{\+([^+]+)\+\}$/
const additionPasteRegex = /\{\+([^+]+)\+\}/g

const deletionInputRegex = /\[-([^\]]+)-\]$/
const deletionPasteRegex = /\[-([^\]]+)-\]/g

export const PatchAdditionMark = Mark.create({
  name: 'patchAddition',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      { tag: 'ins[data-patch-diff="addition"]' },
      { tag: 'ins.patch-diff-addition' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'ins',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-patch-diff': 'addition',
        class: 'patch-diff-addition',
      }),
      0,
    ]
  },

  renderMarkdown(node, helpers) {
    const content = helpers.renderChildren(node.content ?? [])
    return `{+${content}+}`
  },

  addCommands() {
    return {
      setPatchAddition:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name)
        },
      unsetPatchAddition:
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

export const PatchDeletionMark = Mark.create({
  name: 'patchDeletion',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      { tag: 'del[data-patch-diff="deletion"]' },
      { tag: 'del.patch-diff-deletion' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'del',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-patch-diff': 'deletion',
        class: 'patch-diff-deletion',
      }),
      0,
    ]
  },

  renderMarkdown(node, helpers) {
    const content = helpers.renderChildren(node.content ?? [])
    return `[-${content}-]`
  },

  addCommands() {
    return {
      setPatchDeletion:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name)
        },
      unsetPatchDeletion:
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
