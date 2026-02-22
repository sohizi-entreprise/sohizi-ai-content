/**
 * Scene & Dialogue Writing Skill
 * 
 * Teaches the AI how to write professional scenes and dialogue.
 */

import type { FormatAwareSkill } from './types'

export const sceneWritingSkill: FormatAwareSkill = {
  default: () => `
---
name: writing-scenes
description: Writes professional scenes with authentic dialogue, subtext, and visual storytelling. Use when converting outline scenes into full script content.
---

## Task
Write compelling scenes with authentic dialogue that brings characters to life and advances the story.

## Scene Structure

1. **Opening Hook**: Start with something compelling
2. **Escalation**: Build tension or deepen engagement
3. **Turn**: A shift, revelation, or decision
4. **Exit**: End with momentum (don't wrap up too neatly)

**"Late In, Early Out"**: Enter as late as possible, leave as early as possible.

## Dialogue Craft

### Principles
- Dialogue is NOT real speech - it's distilled and purposeful
- Each character has distinct voice
- Subtext is king - characters rarely say exactly what they mean
- Every line must: reveal character, advance plot, establish tone, OR create tension

### Techniques

**Indirect Communication**
Instead of: "I'm angry at you for leaving."
Try: "Nice of you to finally show up."

**Deflection**
Characters can: answer a different question, respond with a question, change subject, use humor as defense

**Interruption**: Characters cut each other off, thoughts trail off...

### Parentheticals (Use Sparingly)
Only when delivery isn't obvious from context. Keep to 1-3 words.

## Action Lines

- Write what we SEE and HEAR (no internal thoughts)
- Present tense, active voice
- Be specific and visual
- Short paragraphs (2-4 lines max)

**Character Introduction** (first appearance):
NAME in CAPS, age in parentheses, one vivid detail.
*"SARAH (28) sits alone, methodically shredding a napkin into perfect strips."*

## Output
Format as ProseMirror JSON using screenplay nodes: sceneHeading, action, character, parenthetical, dialogue, transition.
`,

  formats: {
    storytime: () => `
---
name: writing-scenes
description: Writes narrative prose optimized for spoken delivery and listener engagement. Use when writing storytime content from outline segments.
---

## Task
Write content for **storytime** - optimized for spoken delivery where a narrator tells the story directly to the audience.

## The Narrator's Role

- Audience's guide through the story
- Emotional anchor shaping how we feel
- Storyteller with personality (not neutral observer)
- Bridge between story world and viewer

## Narration Techniques

### Show AND Tell
Unlike screenwriting, storytime can:
- Describe internal states
- Provide context and backstory
- Reflect on meaning
- Address audience directly

### Pacing Through Prose
- Short sentences = tension, speed
- Longer sentences = reflection, building
- Fragments = impact, emphasis
- Vary rhythm for engagement

### Narrator Voice
Can use:
- "Now, here's where it gets interesting..."
- "She had no idea what was waiting..."
- "You know that feeling when..."
- "If only she had known..."

## Dialogue in Storytime

**Quoted Dialogue**: Use sparingly but powerfully
- Make it count
- Keep it brief
- Character voice must be distinct

**Paraphrased Dialogue**: Often more effective
- "She told him it was over."
- "He tried to explain, but the words wouldn't come."

## Description for the Ear

- Sentences that flow when read aloud
- Natural breath points
- Rhythm and musicality
- Avoid tongue-twisters

**Rule of Three**: Three details are more memorable than four.

## Engagement Techniques

**Hooks**: Provocative statement, question, unexpected detail, tension

**Mid-Scene Holds**: "But here's the thing...", "What she didn't know...", "And that's when..."

**Direct Address**: "You have to understand...", "Imagine being in her shoes..."

## Output
Format as ProseMirror JSON using: heading, paragraph, with marks (bold, italic) for emphasis.
`,
  }
}

export default sceneWritingSkill
