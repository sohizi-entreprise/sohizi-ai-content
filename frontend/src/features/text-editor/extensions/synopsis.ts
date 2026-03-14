import { Node, mergeAttributes } from '@tiptap/core'

// ============================================================================
// CUSTOM EXTENSIONS
// ============================================================================

// Synopsis Title Node
export const SynopsisTitleNode = Node.create({
  name: 'synopsisTitle',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id'),
        renderHTML: attributes => {
          if (!attributes.blockId) return {}
          return { 'data-block-id': attributes.blockId }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'h1[data-type="synopsis-title"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['h1', mergeAttributes(HTMLAttributes, { 
      'data-type': 'synopsis-title',
      class: 'synopsis-title' 
    }), 0]
  },
})

// Synopsis Divider Node (non-editable)
export const SynopsisDividerNode = Node.create({
  name: 'synopsisDivider',
  group: 'block',
  atom: true, // Makes it non-editable
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id'),
        renderHTML: attributes => {
          if (!attributes.blockId) return {}
          return { 'data-block-id': attributes.blockId }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="synopsis-divider"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'synopsis-divider',
        class: 'synopsis-divider',
        contenteditable: 'false',
      }),
      ['div', { class: 'synopsis-divider-line' }],
      ['span', { class: 'synopsis-divider-text' }, 'Synopsis review'],
      ['div', { class: 'synopsis-divider-line' }],
    ]
  },
})

// Synopsis Content Node (paragraph for the main text)
export const SynopsisContentNode = Node.create({
  name: 'synopsisContent',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id'),
        renderHTML: attributes => {
          if (!attributes.blockId) return {}
          return { 'data-block-id': attributes.blockId }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="synopsis-content"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'synopsis-content',
      class: 'synopsis-content' 
    }), 0]
  },
})

// Synopsis Spacer Node (empty paragraph between content, no placeholder)
export const SynopsisSpacerNode = Node.create({
  name: 'synopsisSpacer',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'div[data-type="synopsis-spacer"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'synopsis-spacer',
      class: 'synopsis-spacer' 
    }), 0]
  },
})