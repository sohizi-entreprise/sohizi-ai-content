import skillMdSyntaxPrompt from "../prompts/skill-md-syntax"
import storyboardMdSyntaxPrompt from "../prompts/storyboard-md-syntax"
import imageVideoGenerationSkill from "../skills/image-video-generation"

export const supportedAgents = [
  "main-agent",
  "explorer",
  "web-searcher",
  "motion-graphic",
] as const

export const SYSTEM_LEVEL_FILES = {
  "/system/syntax/skill": {
    description:
      "Describes the syntax and instructions to follow for a skill file.",
    content: skillMdSyntaxPrompt,
  },
  "/system/syntax/storyboard": {
    description:
      "Describes the markdown syntax and instructions to follow for a storyboard file.",
    content: storyboardMdSyntaxPrompt,
  },
  "/system/skills/image-video-generation": {
    description: "Rules to follow before generating images and videos.",
    content: imageVideoGenerationSkill,
  },
} as const
