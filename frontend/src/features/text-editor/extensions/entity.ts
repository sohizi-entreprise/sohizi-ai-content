import { Node, mergeAttributes } from '@tiptap/core'
import { CharacterHeaderExtension, EntityHeaderExtension } from './entity-header'

// Character field names
const CHARACTER_FIELD_NAMES = [
  'physicalDescription',
  'personalityTraits',
  'backstory',
  'motivation',
  'flaw',
  'voice',
] as const

// Location field names
const LOCATION_FIELD_NAMES = ['locationDescription'] as const

// Prop field names
const PROP_FIELD_NAMES = ['propDescription'] as const

export type CharacterFieldNodeName = (typeof CHARACTER_FIELD_NAMES)[number]
export type LocationFieldNodeName = (typeof LOCATION_FIELD_NAMES)[number]
export type PropFieldNodeName = (typeof PROP_FIELD_NAMES)[number]
export type EntityFieldNodeName = CharacterFieldNodeName | LocationFieldNodeName | PropFieldNodeName

function createEntityFieldNode(name: string) {
  return Node.create({
    name,
    group: 'block',
    content: 'inline*',
    marks: '',
    isolating: true,

    addAttributes() {
      return {
        label: { default: name },
        placeholder: { default: '' },
      }
    },

    parseHTML() {
      return [{ tag: `div[data-type="entity-field"][data-field="${name}"]` }]
    },

    renderHTML({ HTMLAttributes, node }) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-type': 'entity-field',
          'data-field': name,
          class: 'entity-tiptap-field',
        }),
        ['div', { class: 'entity-tiptap-field-label', contenteditable: 'false' }, node.attrs.label],
        ['div', { class: 'entity-tiptap-field-value', 'data-placeholder': node.attrs.placeholder }, 0],
      ]
    },

    addKeyboardShortcuts() {
      return {
        Enter: () => {
          if (this.editor.state.selection.$from.parent.type.name !== name) return false
          return this.editor.commands.setHardBreak()
        },
      }
    },
  })
}

// Character field nodes
export const PhysicalDescriptionNode = createEntityFieldNode('physicalDescription')
export const PersonalityTraitsNode = createEntityFieldNode('personalityTraits')
export const BackstoryNode = createEntityFieldNode('backstory')
export const MotivationNode = createEntityFieldNode('motivation')
export const FlawNode = createEntityFieldNode('flaw')
export const VoiceNode = createEntityFieldNode('voice')

// Location field nodes
export const LocationDescriptionNode = createEntityFieldNode('locationDescription')

// Prop field nodes
export const PropDescriptionNode = createEntityFieldNode('propDescription')

// Export arrays for easy registration
export const CharacterFieldNodes = [
  PhysicalDescriptionNode,
  PersonalityTraitsNode,
  BackstoryNode,
  MotivationNode,
  FlawNode,
  VoiceNode,
  CharacterHeaderExtension
] 

export const LocationFieldNodes = [LocationDescriptionNode, EntityHeaderExtension]

export const PropFieldNodes = [PropDescriptionNode, EntityHeaderExtension]

export const AllEntityFieldNodes = [
  ...CharacterFieldNodes,
  ...LocationFieldNodes,
  ...PropFieldNodes,
] as const
