/**
 * Script Review Skill
 * 
 * Teaches the AI how to review scripts and provide actionable feedback.
 */

import type { FormatAwareSkill } from './types'

export const scriptReviewSkill: FormatAwareSkill = {
  default: () => `
---
name: reviewing-scripts
description: Reviews scripts for quality, alignment with requirements, and provides actionable feedback. Use after script writing to ensure quality standards are met.
---

## Task
Review the script and provide actionable feedback to ensure it meets quality standards and aligns with project requirements.

## Review Framework

### 1. Alignment Check
- Genre adherence
- Tone consistency
- Audience appropriateness
- Duration feasibility

### 2. Story Structure
- Opening hooks immediately?
- Complications escalate?
- Clear midpoint shift?
- Climax delivers payoff?
- Resolution satisfying?
- Pacing appropriate?

### 3. Character Assessment
- Protagonist has clear want/need?
- Active in driving story?
- Undergoes meaningful change?
- Each character distinct voice?
- Subtext present in dialogue?

### 4. Scene-by-Scene
For each scene:
- Does it need to exist?
- Is there conflict/tension?
- Does something change?
- Starts late enough? Ends with momentum?

### 5. Technical Quality
- Format compliance
- Writing economy
- Grammar/spelling

## Feedback Categories

**Critical** (Must Fix): Plot holes, character inconsistencies, broken scenes, pacing disasters

**Major** (Should Fix): Weak scenes, flat dialogue, missing emotional beats

**Minor** (Could Fix): Line-level improvements, polish items

**Strengths**: What's working well

## Output

JSON object:
\`\`\`json
{
  "overallScore": 0.0-1.0,
  "passed": true/false,
  "summary": "2-3 sentence assessment",
  "feedback": [{
    "id": "feedback_1",
    "category": "critical|major|minor|strength",
    "area": "structure|character|dialogue|pacing|tone|technical",
    "location": "Scene X / General",
    "issue": "Clear description",
    "recommendation": "Specific fix"
  }],
  "approvedForNextStage": true/false,
  "requiresRevision": true/false,
  "revisionPriority": ["feedback_1", "feedback_2"]
}
\`\`\`

**Pass Threshold**: Score ≥ 0.7, no critical issues, core story works.
`,

  formats: {
    storytime: () => `
---
name: reviewing-scripts
description: Reviews storytime scripts for narrative quality and spoken delivery suitability. Use to ensure storytime content works when heard, not just read.
---

## Task
Review a **storytime** script for both narrative quality and suitability for spoken delivery.

## Storytime Review Criteria

### 1. Narration Quality

**Speakability**
- Sentences flow when read aloud?
- Awkward constructions?
- Natural breath points?
- Tongue-twisters?

**Rhythm & Pacing**
- Sentence length variety?
- Momentum maintained?

**Narrator Voice**
- Consistent personality?
- Engaging for target audience?
- Right balance of showing vs telling?

### 2. Engagement Factors

**Opening Hook**: Grabs attention in first 30 seconds?

**Sustained Interest**
- Mini-hooks throughout?
- Cliffhangers at break points?
- Emotional variety?

**Payoff**: Delivers on promises? Emotional satisfaction?

### 3. Story Assessment
- Easy to follow aurally?
- Clear transitions?
- Emotional arc present?
- Characters memorable?

### 4. Duration Check
- Average narration: ~150 words/minute
- Word count appropriate for target duration?

## Red Flags
- Complex sentences that lose listener
- Too much dialogue without narrative framing
- Passive narrator voice
- Information dumps
- No hooks or engagement points
- Monotonous pacing

## Output

JSON object:
\`\`\`json
{
  "overallScore": 0.0-1.0,
  "passed": true/false,
  "summary": "Assessment focused on storytime effectiveness",
  "storytimeMetrics": {
    "speakability": {"score": 0.0-1.0, "notes": "..."},
    "engagement": {"score": 0.0-1.0, "notes": "..."},
    "narratorVoice": {"score": 0.0-1.0, "notes": "..."},
    "pacing": {"score": 0.0-1.0, "notes": "..."}
  },
  "estimatedDuration": {
    "wordCount": 0,
    "estimatedMinutes": 0.0,
    "withinTarget": true/false
  },
  "feedback": [{
    "id": "feedback_1",
    "category": "critical|major|minor|strength",
    "area": "narration|engagement|story|pacing|technical",
    "location": "Section reference",
    "issue": "Description",
    "recommendation": "Fix"
  }],
  "approvedForNextStage": true/false,
  "requiresRevision": true/false,
  "revisionPriority": ["feedback_1"]
}
\`\`\`

**Pass Criteria**: Score ≥ 0.75, speakability ≥ 0.8, duration within 10% of target.
`,
  }
}

export default scriptReviewSkill
