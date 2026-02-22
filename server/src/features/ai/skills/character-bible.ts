/**
 * Character Bible Generation Skill
 * 
 * Teaches the AI how to create rich, deep character profiles.
 */

import type { FormatAwareSkill } from './types'

export const characterBibleSkill: FormatAwareSkill = {
  default: () => `
---
name: generating-character-bible
description: Creates detailed character profiles with psychology, voice, and relationships. Use after outline is complete to establish consistent characterization.
---

## Task
Create detailed character profiles ensuring consistent, compelling characterization throughout the script.

## Character Elements

### 1. Identity
- Name (full + nicknames)
- Age, role, occupation

### 2. Physical Presence
- Distinctive features
- How they carry themselves
- What people notice first

### 3. Psychology

**Personality Traits** (3-5):
- Mix positive and negative
- Include at least one contradiction

**Backstory**: Formative experiences, wounds they carry

**Motivation**:
- Want (external goal)
- Need (internal growth)
- Gap between them = dramatic tension

**Flaw**: Internal obstacle, the lie they believe

### 4. Voice

**Speech Pattern**: Sentence structure, vocabulary, rhythm

**Verbal Tics**: Catchphrases, filler words, topics they avoid

**Sample Dialogue**: 2-3 lines capturing their voice

### 5. Relationships
- How they see other characters
- Source of conflict/connection
- Evolution through story

## Output

JSON array:
\`\`\`json
[{
  "id": "char_protagonist",
  "name": "Full Name",
  "role": "protagonist|antagonist|supporting|minor",
  "age": 32,
  "occupation": "Their job",
  "physicalDescription": "Character-revealing details",
  "personalityTraits": ["trait1", "trait2", "trait3"],
  "backstory": "What shaped them",
  "motivation": "What they want and why",
  "flaw": "Their key internal obstacle",
  "voice": "How they speak + 1-2 sample lines"
}]
\`\`\`
`,

  formats: {
    storytime: () => `
---
name: generating-character-bible
description: Creates character profiles optimized for narrator-driven storytelling. Use when developing characters that must come alive through description and voice.
---

## Task
Create characters for **storytime** - they must be vivid enough to exist in the audience's imagination through narration alone.

## Storytime Character Principles

- **Instantly Graspable**: Audience can't rewind - clear, memorable hooks
- **Live Through Description**: Narrator paints them into existence
- **Distinctive Voices**: When quoted, each character sounds unique
- **Quick Empathy**: Limited time means efficient emotional connection

## Character Elements

### 1. Introduction Hook
Single vivid image capturing their essence:
*"Sarah was the kind of person who alphabetized her spice rack but couldn't remember her own phone number."*

### 2. The Three Layers
- **Surface**: What people see (appearance, behavior)
- **Social**: How they relate to others
- **Private**: What they hide (fears, desires, secrets)

### 3. Voice Signature
When narrator quotes this character:
- What makes their speech instantly recognizable?
- Catchphrases or verbal habits
- How does their voice contrast with others?

### 4. Emotional Handle
What makes audience care:
- Relatable struggle
- Vulnerability creating sympathy
- Quality audience admires

### 5. Visual Anchor
1-2 details for audience to "see":
- Physical trait reflecting personality
- Signature item or style

## Output

JSON array:
\`\`\`json
[{
  "id": "char_protagonist",
  "name": "Name or Descriptor",
  "role": "protagonist|antagonist|supporting|minor",
  "age": 28,
  "occupation": "What they do",
  "physicalDescription": "2-3 vivid, narrator-friendly details",
  "personalityTraits": ["trait1", "trait2", "trait3"],
  "backstory": "Brief but evocative",
  "motivation": "What drives them - stated simply",
  "flaw": "Internal obstacle, framed sympathetically",
  "voice": "How they speak when quoted. Include 1-2 sample lines."
}]
\`\`\`
`,
  }
}

export default characterBibleSkill
