/**
 * Script Outline Generation Skill
 * 
 * Teaches the AI how to create outlines using the 15 Beat Sheet structure.
 */

import type { FormatAwareSkill } from './types'

export const outlineSkill: FormatAwareSkill = {
  default: () => `
---
name: generating-outline
description: Creates a scene-by-scene outline using the 15 Beat Sheet (Save the Cat!) structure. Use after synopsis is approved to create the script blueprint.
---

## Task
Transform the synopsis into a detailed outline using the **15 Beat Sheet** structure.

## The 15 Beats

### ACT 1 (0-25%)
1. **Opening Image** (0-1%): Visual "before" state, sets tone
2. **Theme Stated** (5%): The lesson, stated by someone other than protagonist
3. **Setup** (1-10%): Ordinary world, characters, flaws
4. **Catalyst** (10%): Inciting incident - life changes
5. **Debate** (10-20%): Hesitation - should they act?
6. **Break into Two** (20-25%): Active choice to enter new world

### ACT 2A (25-50%)
7. **B Story** (22-25%): Secondary storyline, often carries theme
8. **Fun and Games** (25-50%): Promise of the premise delivered
9. **Midpoint** (50%): False victory OR false defeat, stakes raised

### ACT 2B (50-75%)
10. **Bad Guys Close In** (50-75%): Pressure mounts, things fall apart
11. **All Is Lost** (75%): Lowest point, something is "lost"
12. **Dark Night of the Soul** (75-80%): Processing the loss, despair

### ACT 3 (80-100%)
13. **Break into Three** (80%): Fresh idea, synthesis of learning
14. **Finale** (80-99%): Final confrontation, transformation proven
15. **Final Image** (99-100%): Opposite of opening, shows change

## Scene Design

Every scene must:
- Advance plot OR develop character (ideally both)
- Have clear purpose within its beat
- Begin late, end early
- Create change

## Slugline Format
\`INT./EXT. LOCATION - TIME\`
(TIME: DAY, NIGHT, MORNING, EVENING, CONTINUOUS, LATER)

## Output

JSON array of beats:
\`\`\`json
[{
  "actId": "act_1",
  "beat": {
    "beatId": "beat_1_opening_image",
    "title": "Opening Image",
    "summary": "What this beat accomplishes",
    "goals": ["Goal 1", "Goal 2"],
    "turningPoints": ["Key moment"]
  },
  "scenes": [{
    "sceneId": "scene_1",
    "slugline": "INT. LOCATION - TIME",
    "summary": "What happens and why"
  }]
}]
\`\`\`
`,

  formats: {
    storytime: () => `
---
name: generating-outline
description: Creates a storytime outline using the 15 Beat Sheet adapted for narrator-driven content. Use when structuring a storytime video from an approved synopsis.
---

## Task
Create an outline for **storytime** using the **15 Beat Sheet** adapted for narrator-driven storytelling.

## The 15 Beats (Storytime Adapted)

### ACT 1 - HOOK & SETUP
1. **Opening Image**: Narrator's first words - make them count. [HOOK]
2. **Theme Stated**: Narrator hints at deeper meaning. [DIRECT ADDRESS]
3. **Setup**: Paint the protagonist's world
4. **Catalyst**: "And then everything changed..." [PAUSE]
5. **Debate**: Explore protagonist's hesitation. [QUESTION]
6. **Break into Two**: Commitment. "There was no going back..."

### ACT 2A - THE JOURNEY
7. **B Story**: Secondary thread, different perspective
8. **Fun and Games**: Heart of your storytime, vary pacing
9. **Midpoint**: "But here's where it gets interesting..." [REVEAL]

### ACT 2B - THE DESCENT
10. **Bad Guys Close In**: Things fall apart. [TENSION BUILD]
11. **All Is Lost**: "And that's when they lost everything..." [PAUSE]
12. **Dark Night of the Soul**: Sit with the pain. [SOFTER]

### ACT 3 - TRANSFORMATION
13. **Break into Three**: "But then they realized..." [CALLBACK]
14. **Finale**: Climactic moment. [BUILDING]
15. **Final Image**: Mirror opening, show change. [DIRECT ADDRESS]

## Narrator Technique Markers

- [HOOK] - Attention-grabbing moment
- [PAUSE] - Dramatic silence
- [DIRECT ADDRESS] - Speaking to audience
- [QUESTION] - Rhetorical question
- [REVEAL] - Key information unveiled
- [CALLBACK] - Reference to earlier detail
- [SOFTER] - Intimate, quieter moment
- [BUILDING] - Rising intensity

## Slugline Format (Storytime)
\`VISUAL: DESCRIPTION - CONTEXT\`

## Output

JSON array of beats:
\`\`\`json
[{
  "actId": "act_1",
  "beat": {
    "beatId": "beat_1_opening_image",
    "title": "Opening Image",
    "summary": "What this beat accomplishes",
    "goals": ["Goal 1"],
    "turningPoints": ["Key moment"]
  },
  "scenes": [{
    "sceneId": "segment_1",
    "slugline": "VISUAL: DESCRIPTION - CONTEXT",
    "summary": "What narrator says and what we see. Include [TECHNIQUE] markers."
  }]
}]
\`\`\`
`,
  }
}

export default outlineSkill
