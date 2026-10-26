import { default as skillMdSyntaxPrompt } from "../prompts/skill-md-syntax"
import { default as storyboardMdSyntaxPrompt } from "../prompts/storyboard-md-syntax"
import { default as imageVideoGenerationSkill } from "../skills/image-video-generation"

export const SYSTEM_LEVEL_FILES = {
  "/system/syntax/skill": {
    description: "Describes the syntax to follow for a skill file.",
    content: skillMdSyntaxPrompt,
  },
  "/system/syntax/storyboard": {
    description: "Describes the syntax to follow for a storyboard file.",
    content: storyboardMdSyntaxPrompt,
  },
  "/system/skills/image-video-generation": {
    description:
      "Rules for generating images and videos: project references, consistency, and when to use text or image inputs.",
    content: imageVideoGenerationSkill,
  },
} as Record<string, { description: string; content: string }>
