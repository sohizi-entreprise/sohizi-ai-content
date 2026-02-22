/**
 * Narrative Arc Generation Skill
 * 
 * Teaches the AI how to generate high-quality, original narrative arcs.
 */

import type { FormatAwareSkill } from './types'

export const narrativeArcSkill: FormatAwareSkill = {
  default: () => `
---
name: generating-narrative-arcs
description: Generates 3 distinct narrative arc concepts from a story idea. Use when starting a new project or when the user needs story concept options.
---

## Task
Generate 3 distinct, high-quality narrative arc concepts from the provided story idea.

## Arc Differentiation Strategy

Each arc should take a meaningfully different approach:
1. **Intuitive**: What most audiences would expect from this premise
2. **Subversive**: Challenge assumptions or flip expectations  
3. **Emotional**: Focus on character interiority and transformation

## Required Elements Per Arc

**Title**: Evocative, memorable (not generic)

**Logline**: Single sentence including:
- Protagonist + defining trait
- Central conflict
- Stakes
- Hint of emotional journey

**Synopsis**: 2-3 paragraphs covering setup, conflict, complications, and climactic turning point (without spoiling resolution)

**Tags**: genre[], tone[], themes[]

## Quality Criteria

- Self-contained and producible within target duration
- Protagonist has clear want AND deeper need
- Meaningful stakes at risk
- No passive protagonists
- Specific, concrete details
`,

  formats: {
    storytime: () => `
---
name: generating-narrative-arcs
description: Generates 3 narrative arc concepts optimized for storytime/narrator-driven format. Use when creating story concepts for spoken delivery content.
---

## Task
Generate 3 distinct narrative arcs optimized for **storytime** (narrator-driven storytelling).

## Storytime Considerations

- Narrator is the audience's guide and emotional anchor
- Conversational, intimate tone works best
- Build in moments for direct audience address
- Cliffhangers and reveals are powerful tools
- Story should feel like it's being told by someone who lived it

## Arc Differentiation

1. **Relatable Journey**: Personal and universal, audience could imagine it happening to them
2. **Unexpected Twist**: Subverts expectations with a recontextualizing reveal
3. **Emotional Deep-Dive**: Internal transformation, complex emotions

## Required Elements Per Arc

**Title**: Intriguing, clickable, suggests a story worth hearing

**Logline**: Makes someone say "I need to hear this story"
- Include the hook
- Hint at emotional journey or surprise

**Synopsis**: Setup → Disruption → Escalation → Turning point → Emotional resolution

**Tags**: genre[], tone[], themes[]

## Quality Criteria

- Tellability: Would someone share this at a dinner party?
- Narrative voice: Can you hear a narrator telling this?
- Visual moments: Scenes that would be compelling to visualize
- Emotional hook: Makes you feel something
- Hooks within first 30 seconds

## Output

JSON array with exactly 3 objects:
\`\`\`json
[{
  "title": "string",
  "logline": "string",
  "synopsis": "string",
  "genre": ["string"],
  "tone": ["string"],
  "themes": ["string"],
  "source": "agent",
  "isSelected": false
}]
\`\`\`
`,
  }
}

export default narrativeArcSkill
