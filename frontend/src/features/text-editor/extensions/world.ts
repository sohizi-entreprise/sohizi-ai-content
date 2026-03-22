import { Node, mergeAttributes } from '@tiptap/core'

const WORLD_FIELD_NAMES = [
  'setting',
  'timePeriod',
  'worldRules',
  'socialContext',
  'uniqueWorldElements',
  'centralConflict',
  'stakes',
  'antagonisticForce',
  'timePressure',
  'mainDramaticQuestion',
  'visualStyle',
  'dialogueStyle',
  'pacing',
  'factsToConsistent',
  'characterBehaviorRules',
  'worldLogicRules',
  'thingsToAvoid',
] as const

export type WorldFieldNodeName = (typeof WORLD_FIELD_NAMES)[number]

export const WorldSectionHeadingNode = Node.create({
  name: 'worldSectionHeading',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      title: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="world-section-heading"]' }]
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-type': 'world-section-heading',
        class: 'world-section-heading',
        contenteditable: 'false',
      },
      ['div', { class: 'world-section-heading-line' }],
      ['span', { class: 'world-section-heading-text' }, node.attrs.title],
      ['div', { class: 'world-section-heading-line' }],
    ]
  },
})

function createWorldFieldNode(name: WorldFieldNodeName) {
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
      return [{ tag: `div[data-type="world-field"][data-field="${name}"]` }]
    },

    renderHTML({ HTMLAttributes, node }) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-type': 'world-field',
          'data-field': name,
          class: 'world-field',
        }),
        ['div', { class: 'world-field-label', contenteditable: 'false' }, node.attrs.label],
        ['div', { class: 'world-field-value', 'data-placeholder': node.attrs.placeholder }, 0],
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

export const SettingNode = createWorldFieldNode('setting')
export const TimePeriodNode = createWorldFieldNode('timePeriod')
export const WorldRulesNode = createWorldFieldNode('worldRules')
export const SocialContextNode = createWorldFieldNode('socialContext')
export const UniqueWorldElementsNode = createWorldFieldNode('uniqueWorldElements')
export const CentralConflictNode = createWorldFieldNode('centralConflict')
export const StakesNode = createWorldFieldNode('stakes')
export const AntagonisticForceNode = createWorldFieldNode('antagonisticForce')
export const TimePressureNode = createWorldFieldNode('timePressure')
export const MainDramaticQuestionNode = createWorldFieldNode('mainDramaticQuestion')
export const VisualStyleNode = createWorldFieldNode('visualStyle')
export const DialogueStyleNode = createWorldFieldNode('dialogueStyle')
export const PacingNode = createWorldFieldNode('pacing')
export const FactsToConsistentNode = createWorldFieldNode('factsToConsistent')
export const CharacterBehaviorRulesNode = createWorldFieldNode('characterBehaviorRules')
export const WorldLogicRulesNode = createWorldFieldNode('worldLogicRules')
export const ThingsToAvoidNode = createWorldFieldNode('thingsToAvoid')

export const WorldFieldNodes = [
  SettingNode,
  TimePeriodNode,
  WorldRulesNode,
  SocialContextNode,
  UniqueWorldElementsNode,
  CentralConflictNode,
  StakesNode,
  AntagonisticForceNode,
  TimePressureNode,
  MainDramaticQuestionNode,
  VisualStyleNode,
  DialogueStyleNode,
  PacingNode,
  FactsToConsistentNode,
  CharacterBehaviorRulesNode,
  WorldLogicRulesNode,
  ThingsToAvoidNode,
] as const

