/**
 * Synopsis Generation Skill
 * 
 * Teaches the AI how to expand a narrative arc into a detailed synopsis.
 */

import type { FormatAwareSkill } from './types'

export const synopsisSkill: FormatAwareSkill = {
  default: () => `
---
name: generating-synopsis
description: Expands a selected narrative arc into a complete, detailed synopsis. Use after the user has selected a narrative arc concept.
---

## Synopsis Structure

**1. Hook (Opening)**
- Establish world and tone immediately
- Introduce protagonist in a characteristic moment
- Plant seeds of central conflict

**2. Setup (Act 1)**
- Protagonist's ordinary world
- Want (external goal) vs Need (internal growth)
- Key relationships
- Inciting incident

**3. Confrontation (Act 2)**
- Escalating obstacles
- Rising stakes
- Character development through challenge
- Midpoint shift
- "Dark night of the soul"

**4. Resolution (Act 3)**
- Climactic confrontation
- Transformation/choice
- Conflict resolution
- New equilibrium

## Writing Guidelines

**Do:**
- Present tense, third person
- Specific actions and emotions
- Show cause and effect
- Highlight emotional turning points

**Don't:**
- Vague language ("things happen")
- Camera directions
- Actual dialogue (paraphrase instead)
- Over-explain themes
`,

  formats: {
    storytime: () => `
---
name: generating-synopsis
description: Creates a synopsis optimized for narrator-driven storytelling. Use when developing a storytime video synopsis from a selected arc.
---

## Task
Develop a synopsis for **storytime** format - optimized for oral delivery where a narrator tells the story directly to the audience.

## Narrative Voice Considerations

- Story will be TOLD, not shown through pure action
- Plan for narrator commentary and reflection
- Include suspense-building moments
- Allow for direct audience address
- Consider what narrator knows vs. what they reveal when

## Structure for Oral Storytelling

**1. Hook (First 30 seconds)**
- Provocative statement or question
- Immediately establish stakes or intrigue
- Promise something worth their time

**2. Setup**
- Introduce protagonist through relatable lens
- Establish the "normal" about to be disrupted
- Plant details that pay off later

**3. Journey**
- Escalating complications
- Each beat ends with mini-hook
- Include "reaction moments" - how did this feel?
- Build toward revelation/confrontation

**4. Climax**
- Moment of truth
- Maximum emotional intensity
- Choice or realization that changes everything

**5. Resolution**
- Emotional landing
- What was learned/changed
- Optional callback to opening

## Storytime Elements

- [BEAT] markers for major story beats
- [HOOK] markers for engagement moments
- Natural pause points
- Cliffhanger opportunities
`,
  }
}

export default synopsisSkill
