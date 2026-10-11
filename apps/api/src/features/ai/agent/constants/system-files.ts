import { default as skillMdSyntaxPrompt } from "../prompts/skill-md-syntax"
import { default as storyboardMdSyntaxPrompt } from "../prompts/storyboard-md-syntax"

export const SYSTEM_LEVEL_SYNTAX_FILES_MAP = {
  "/system/syntax/skill": {
    description: "Describes the syntax to follow for a skill file.",
    content: skillMdSyntaxPrompt,
  },
  "/system/syntax/storyboard": {
    description: "Describes the syntax to follow for a storyboard file.",
    content: storyboardMdSyntaxPrompt,
  },
} as Record<string, { description: string; content: string }>
