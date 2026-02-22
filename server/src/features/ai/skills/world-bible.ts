/**
 * World Bible Generation Skill (Locations & Props)
 * 
 * Teaches the AI how to create detailed location and prop descriptions.
 */

import type { FormatAwareSkill } from './types'

export const worldBibleSkill: FormatAwareSkill = {
  default: () => `
---
name: generating-world-bible
description: Creates detailed locations and significant props that establish the visual world. Use after outline to define the story's physical environment.
---

## Task
Create detailed descriptions of locations and significant props for the story world.

## Location Elements

### 1. Identity
- Specific name (not just "apartment" but "Sarah's Studio Apartment")
- Type: Interior/Exterior, public/private

### 2. Physical Description
- Layout and size
- Key architectural features
- Lighting (natural/artificial)
- Color palette and textures
- State of order/disorder

### 3. Atmosphere
- Emotional quality of the space
- Sensory details (sounds, smells, temperature)
- How it makes people feel

### 4. Significance
- What it represents thematically
- How it reflects characters who use it
- Does it change over the story?

## Prop Criteria

Only detail props that:
- Are handled or referenced in dialogue
- Have narrative significance
- Appear in multiple scenes
- Carry symbolic meaning

### Prop Elements
- Physical appearance (size, material, condition)
- Distinctive features
- History/wear that tells a story
- Why it matters

## Output

JSON object:
\`\`\`json
{
  "timePeriod": "When the story takes place",
  "setting": "General geographic/cultural setting",
  "locations": [{
    "id": "loc_apartment",
    "name": "Sarah's Studio Apartment",
    "description": "Detailed visual description",
    "atmosphere": "Emotional quality and sensory details"
  }],
  "props": [{
    "id": "prop_letter",
    "name": "The Unopened Letter",
    "description": "Physical description with character-revealing details"
  }]
}
\`\`\`
`,

  formats: {
    storytime: () => `
---
name: generating-world-bible
description: Creates locations and props optimized for narrator description. Use when building the visual world for storytime content.
---

## Task
Create the visual world for **storytime** - locations and props must be vivid enough for the narrator to paint them into the audience's imagination.

## Storytime World-Building Principle

**Three perfect details beat ten adequate ones.**

Choose details that:
- Engage multiple senses
- Reveal character or mood
- Stick in memory
- Support emotional beats

## Location Elements

### 1. Establishing Detail
Single image capturing this place:
*"The kind of diner where the coffee is always burnt and the waitress always calls you 'hon'"*

### 2. Sensory Palette
- **Visual**: The key thing to "see"
- **Auditory**: Ambient soundscape
- **Other**: Smell, temperature, texture if relevant

### 3. Emotional Function
What feeling does this location serve?
- Safety / Danger
- Comfort / Discomfort
- Freedom / Confinement

### 4. Description Style
Write descriptions that:
- Could be read aloud naturally
- Use active, evocative language
- Avoid clinical inventory lists
- Embed character perspective

**Instead of:** "The room contained a bed, a desk, and a window."
**Write:** "The room was barely big enough for the bed that dominated it - a bed that hadn't been made in days, sheets twisted like the thoughts of whoever slept there."

## Prop Elements

Only include props the narrator would specifically mention.

Each prop needs:
- Vivid, speakable description
- Clear significance
- Enough detail to visualize, not so much it bogs down

## Output

JSON object:
\`\`\`json
{
  "timePeriod": "When the story takes place",
  "setting": "The world in one evocative sentence",
  "locations": [{
    "id": "loc_diner",
    "name": "The All-Night Diner",
    "description": "Narrator-friendly evocative description",
    "atmosphere": "Emotional quality - how it feels"
  }],
  "props": [{
    "id": "prop_photograph",
    "name": "The Photograph",
    "description": "Vivid, meaningful description"
  }]
}
\`\`\`
`,
  }
}

export default worldBibleSkill
