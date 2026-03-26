import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { v4 as uuid } from 'uuid'
import DialogueComponent from '../components/dialog-component'

export interface DialogueOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogue: {
      setDialogue: () => ReturnType
      toggleDialogue: () => ReturnType
    }
  }
}

export const DialogueExtension = Node.create<DialogueOptions>({
  name: 'dialogue',
  group: 'block',
  content: 'character parenthetical? speech?',
  // defining: true,
  // isolating: true,
  addOptions(){
      return {
          HTMLAttributes: {},
      }
  },
  addAttributes(){
      return {
          id: {
              default: null,
              parseHTML: (element) => element.getAttribute('data-id'),
              renderHTML(attributes) {
                  if(!attributes.id) return { 'data-id': uuid() }
                  return { 'data-id': attributes.id }
              },
          }
      }
  },
  parseHTML: () => {
      return [
          {
              tag: 'div[data-type="dialogue"]',
          }
      ]
  },
  renderHTML({ HTMLAttributes }) {
      return [
          'div',
          mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
              'data-type': 'dialogue',
          }),
          0,
      ]
  },
  addNodeView() {
      return ReactNodeViewRenderer(DialogueComponent)
  },
  addCommands() {
      return {
          setDialogue: () => ({ commands }) => {
              return commands.insertContent({
                  type: this.name,
                  attrs: { id: uuid() },
                  content: [
                    { type: 'character' },
                  ],
                })
          },
      }
  },

})
