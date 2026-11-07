import { default as documentMdSyntaxPrompt } from "../prompts/document-md-syntax"
import { default as skillMdSyntaxPrompt } from "../prompts/skill-md-syntax"
import { default as storyboardMdSyntaxPrompt } from "../prompts/storyboard-md-syntax"
import { default as imageVideoGenerationSkill } from "../skills/image-video-generation"
import { default as planGenerationSkill } from "../skills/plan-generation"

export const SYSTEM_LEVEL_FILES = {
  "/system/syntax/document": {
    description:
      "Read BEFORE creating or editing any document file. Defines the markdown syntax for UI blocks (cards, media, palette, timeline, tree, properties, attributes, moodboard, sources) and inline badges.",
    content: documentMdSyntaxPrompt,
  },
  "/system/syntax/skill": {
    description:
      "Read BEFORE creating or editing a skill file. Defines the required structure and syntax of skill files.",
    content: skillMdSyntaxPrompt,
  },
  "/system/syntax/storyboard": {
    description:
      "Read BEFORE creating or editing a storyboard file. Defines the required structure and syntax of storyboard files.",
    content: storyboardMdSyntaxPrompt,
  },
  "/system/skills/image-video-generation": {
    description:
      "Read BEFORE generating any image or video. Covers choosing text vs. image inputs, picking project references, grounding real-world people/places/products, and keeping characters consistent across shots.",
    content: imageVideoGenerationSkill,
  },
  "/system/skills/generate-plan": {
    description:
      "Read BEFORE writing a production plan. Use when the PLAN command is invoked, or when the user asks to plan, outline, or break down a video from an idea. Defines how to produce a complete, execution-ready plan.",
    content: planGenerationSkill,
  },
} as Record<string, { description: string; content: string }>
