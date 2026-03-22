import { CharacterEntity, LocationEntity, PropEntity } from "@/features/projects/type"
import { JSONContent } from "@tiptap/react"

export const CHARACTER_FIELDS = [
    { key: 'physicalDescription', nodeType: 'physicalDescription', label: 'PHYSICAL PROFILE', placeholder: 'Describe physical appearance...' },
    { key: 'personalityTraits', nodeType: 'personalityTraits', label: 'CORE TRAITS', placeholder: 'Traits separated by commas (e.g., Determined, Secretive, Analytical)...' },
    { key: 'backstory', nodeType: 'backstory', label: 'BACKSTORY', placeholder: "Character's relevant history..." },
    { key: 'motivation', nodeType: 'motivation', label: 'MOTIVATION', placeholder: 'What drives this character...' },
    { key: 'flaw', nodeType: 'flaw', label: 'FATAL FLAW', placeholder: "Character's key weakness..." },
    { key: 'voice', nodeType: 'voice', label: 'VOICE PROFILE', placeholder: 'How the character speaks, with sample dialogue...' },
] as const
  
export const LOCATION_FIELDS = [
    { key: 'description', nodeType: 'locationDescription', label: 'DESCRIPTION', placeholder: 'Detailed visual and atmospheric description of the location...' },
] as const
  
export const PROP_FIELDS = [
    { key: 'description', nodeType: 'propDescription', label: 'DESCRIPTION', placeholder: 'Description of the prop and its narrative significance...' },
] as const

export function toInlineContent(value: string): JSONContent[] | undefined {
    if (!value) return undefined
  
    const content: JSONContent[] = []
    const lines = value.split('\n')
  
    lines.forEach((line, index) => {
      if (line) {
        content.push({ type: 'text', text: line })
      }
      if (index < lines.length - 1) {
        content.push({ type: 'hardBreak' })
      }
    })
  
    return content.length > 0 ? content : undefined
}

export function extractTextFromJsonContent(content?: JSONContent[]): string {
    if (!content?.length) return ''
  
    let result = ''
  
    for (const node of content) {
      if (node.type === 'text') {
        result += node.text ?? ''
        continue
      }
      if (node.type === 'hardBreak') {
        result += '\n'
        continue
      }
      if (node.content) {
        result += extractTextFromJsonContent(node.content)
      }
    }
  
    return result
  }


// Character document builders
export function buildCharacterDoc(metadata: CharacterEntity['metadata']): JSONContent {
    // const metadata = character.metadata
    const content: JSONContent[] = CHARACTER_FIELDS.map((field) => {
      let value = ''
      if (field.key === 'personalityTraits') {
        value = metadata.personalityTraits.join(', ')
      } else {
        value = metadata[field.key] as string
      }
      
      return {
        type: field.nodeType,
        attrs: {
          label: field.label,
          placeholder: field.placeholder,
        },
        content: toInlineContent(value),
      }
    })
  
    return { type: 'doc', content }
}

type CharacterEditorFields = Omit<CharacterEntity['metadata'], 'name' | 'role' | 'age' | 'occupation'>

export function getCharacterFromDoc(doc: JSONContent): CharacterEditorFields {
    const result: CharacterEditorFields = {
      physicalDescription: '',
      personalityTraits: [],
      backstory: '',
      motivation: '',
      flaw: '',
      voice: '',
    }
  
    for (const node of doc.content ?? []) {
      const field = CHARACTER_FIELDS.find((f) => f.nodeType === node.type)
      if (!field) continue
  
      const text = extractTextFromJsonContent(node.content)
  
      switch (field.key) {
        case 'physicalDescription':
          result.physicalDescription = text
          break
        case 'personalityTraits':
          result.personalityTraits = text.split(',').map((t) => t.trim()).filter(Boolean)
          break
        case 'backstory':
          result.backstory = text
          break
        case 'motivation':
          result.motivation = text
          break
        case 'flaw':
          result.flaw = text
          break
        case 'voice':
          result.voice = text
          break
      }
    }
  
    return result
}


// Location document builders
export function buildLocationDoc(metadata: LocationEntity['metadata']): JSONContent {
    const content: JSONContent[] = LOCATION_FIELDS.map((field) => ({
      type: field.nodeType,
      attrs: {
        label: field.label,
        placeholder: field.placeholder,
      },
      content: toInlineContent(metadata[field.key]),
    }))
  
    return { type: 'doc', content }
  }
  
export function getLocationFromDoc(doc: JSONContent): { description: string } {
    const result = { description: '' }
  
    for (const node of doc.content ?? []) {
      if (node.type === 'locationDescription') {
        result.description = extractTextFromJsonContent(node.content)
      }
    }
  
    return result
  }
  
  // Prop document builders
  export function buildPropDoc(metadata: PropEntity['metadata']): JSONContent {
    const content: JSONContent[] = PROP_FIELDS.map((field) => ({
      type: field.nodeType,
      attrs: {
        label: field.label,
        placeholder: field.placeholder,
      },
      content: toInlineContent(metadata[field.key]),
    }))
  
    return { type: 'doc', content }
  }
  
export function getPropFromDoc(doc: JSONContent): { description: string } {
    const result = { description: '' }
  
    for (const node of doc.content ?? []) {
      if (node.type === 'propDescription') {
        result.description = extractTextFromJsonContent(node.content)
      }
    }
  
    return result
}