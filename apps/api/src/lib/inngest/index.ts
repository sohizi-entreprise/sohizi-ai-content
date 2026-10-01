import { handleMediaGeneration } from "@/features/media-engine/inngest"
import { handleHtmlVideoGeneration } from "@/features/media-engine/html-video-inngest"
import { handleVideoExportPoll } from "@/features/video-editor/inngest"

export { inngest } from "./client"

export const functions = [
  handleHtmlVideoGeneration,
  handleMediaGeneration,
  handleVideoExportPoll,
]
