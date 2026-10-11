import { z } from "zod"
import { buildLlmTool } from "./tool-definition"
import modelsTracker from "@/catalog/models-tracker"
import { ModelMessage } from "ai"

const MAX_DURATION = 20 * 60 // 20 minutes

const imgSchema = z.object({
  type: z.literal("image"),
  url: z.url().describe("The URL of the image to analyze"),
  instructions: z.string().describe("The instructions for the analysis"),
})

const videoSchema = z.object({
  type: z.literal("video"),
  url: z.url().describe("The URL of the video to analyze"),
  contentType: z
    .string()
    .describe("The content type of the media file. e.g. video/mp4"),
  instructions: z.string().describe("The instructions for the analysis"),
  startSeconds: z
    .number()
    .optional()
    .describe("The start time of the video to analyze in seconds"),
  endSeconds: z
    .number()
    .optional()
    .describe("The end time of the video to analyze in seconds"),
})

const youtubeSchema = z.object({
  type: z.literal("youtube"),
  url: z.url().describe("The URL of the YouTube video to analyze"),
  instructions: z.string().describe("The instructions for the analysis"),
  startSeconds: z.number().optional(),
  endSeconds: z.number().optional(),
})

const mediaAnalyzerSchema = z.discriminatedUnion("type", [
  imgSchema,
  videoSchema,
  youtubeSchema,
])

export const mediaAnalyzerTool = buildLlmTool({
  name: "mediaAnalyzer",
  description:
    "Analyze an IMAGE, VIDEO, or YOUTUBE VIDEO by its URL and return a summary based on the instructions provided",
  inputSchema: z.object({ cmd: mediaAnalyzerSchema }),
  config: {
    modelId: modelsTracker.imageAnalyzer,
    modelConfig: {
      maxOutputTokens: 2000,
      reasoningEffort: "low",
    },
    buildInput({ cmd: data }) {
      switch (data.type) {
        case "image":
          return buildImageInput(data)
        case "video":
          return buildVideoInput(data)
        case "youtube":
          return buildYoutubeInput(data)
      }
    },
  },
})

export const imageAnalyzerTool = buildLlmTool({
  name: "imageAnalyzer",
  description:
    "Analyze an image by its URL and return a summary based on the instructions provided",
  inputSchema: z.object({
    url: z.url().describe("The URL of the image to analyze"),
    instructions: z
      .string()
      .describe("The instructions for the image analyzer"),
  }),

  config: {
    modelId: modelsTracker.imageAnalyzer,
    modelConfig: {
      maxOutputTokens: 2000,
      reasoningEffort: "low",
    },
    buildInput: (data) => {
      return [
        {
          role: "system",
          content: "",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: data.instructions,
            },
            {
              type: "image",
              image: data.url,
            },
          ],
        },
      ]
    },
  },
})

export const videoAnalyzerTool = buildLlmTool({
  name: "videoAnalyzer",
  description:
    "Analyze a video file by its URL and return a summary based on the instructions provided",
  inputSchema: z.object({
    url: z.url().describe("The URL of the video file to analyze"),
    contentType: z
      .string()
      .describe("The content type of the media file. e.g. video/mp4"),
    instructions: z
      .string()
      .describe("The instructions for the video analyzer"),
    startSeconds: z
      .number()
      .optional()
      .describe("The start time of the video to analyze in seconds"),
    endSeconds: z
      .number()
      .optional()
      .describe("The end time of the video to analyze in seconds"),
  }),

  config: {
    modelId: modelsTracker.videoAnalyzer,
    modelConfig: {
      maxOutputTokens: 2000,
      reasoningEffort: "low",
    },
    buildInput: (data) => {
      const startOffset = data.startSeconds ?? 0
      const endOffset = Math.min(
        data.endSeconds || MAX_DURATION,
        startOffset + MAX_DURATION,
      )
      return [
        {
          role: "system",
          content:
            "Analyze a video file by its URL and return a summary based on the instructions provided",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: data.instructions,
            },
            {
              type: "file",
              data: data.url,
              mediaType: data.contentType,
              providerOptions: {
                google: {
                  videoMetadata: {
                    fps: 1,
                    startOffset: `${startOffset}s`,
                    endOffset: `${endOffset}s`,
                  },
                },
              },
            },
          ],
        },
      ]
    },
  },
})

export const youtubeAnalyzerTool = buildLlmTool({
  name: "youtubeAnalyzer",
  description:
    "Analyze a YouTube video by its URL and return a summary based on the instructions provided",
  inputSchema: z.object({
    url: z.url().describe("The URL of the YouTube video to analyze"),
    instructions: z
      .string()
      .describe("The instructions for the YouTube analyzer"),
    startSeconds: z
      .number()
      .optional()
      .describe("The start time of the video to analyze in seconds"),
    endSeconds: z
      .number()
      .optional()
      .describe("The end time of the video to analyze in seconds"),
  }),

  config: {
    modelId: modelsTracker.youtubeAnalyzer,
    modelConfig: {
      maxOutputTokens: 2000,
      reasoningEffort: "low",
    },
    buildInput: (data) => {
      const startOffset = data.startSeconds ?? 0
      const endOffset = Math.min(
        data.endSeconds || MAX_DURATION,
        startOffset + MAX_DURATION,
      )
      return [
        {
          role: "system",
          content:
            "You are a helpful assistant that analyzes YouTube videos and returns a summary based on the instructions provided",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: data.instructions, // `<instructions>${data.instructions}</instructions>\n<youtube_url>${data.url}</youtube_url>`
            },
            {
              type: "file",
              data: cleanYoutubeUrl(data.url),
              mediaType: "video/mp4",
              providerOptions: {
                google: {
                  videoMetadata: {
                    fps: 1,
                    startOffset: `${startOffset}s`,
                    endOffset: `${endOffset}s`,
                  },
                },
              },
            },
          ],
        },
      ]
    },
  },
})

const getGenericPrompt = (obj: string) => `
Analyze the attached ${obj} and return a summary following the instructions provided.
Do not ask any questions or additional information. Simply complete the task.
`

function buildImageInput(data: z.infer<typeof imgSchema>): ModelMessage[] {
  return [
    {
      role: "system",
      content: getGenericPrompt("image"),
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: data.instructions,
        },
        {
          type: "image",
          image: data.url,
        },
      ],
    },
  ]
}

function buildVideoInput(data: z.infer<typeof videoSchema>): ModelMessage[] {
  const startOffset = data.startSeconds ?? 0
  const endOffset = Math.min(
    data.endSeconds || MAX_DURATION,
    startOffset + MAX_DURATION,
  )
  return [
    {
      role: "system",
      content: getGenericPrompt("video"),
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: data.instructions,
        },
        {
          type: "file",
          data: data.url,
          mediaType: data.contentType,
          providerOptions: {
            google: {
              videoMetadata: {
                fps: 1,
                startOffset: `${startOffset}s`,
                endOffset: `${endOffset}s`,
              },
            },
          },
        },
      ],
    },
  ]
}

function buildYoutubeInput(
  data: z.infer<typeof youtubeSchema>,
): ModelMessage[] {
  const startOffset = data.startSeconds ?? 0
  const endOffset = Math.min(
    data.endSeconds || MAX_DURATION,
    startOffset + MAX_DURATION,
  )
  return [
    {
      role: "system",
      content: getGenericPrompt("YouTube video"),
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: data.instructions,
        },
        {
          type: "file",
          data: cleanYoutubeUrl(data.url),
          mediaType: "video/mp4",
          providerOptions: {
            google: {
              videoMetadata: {
                fps: 1,
                startOffset: `${startOffset}s`,
                endOffset: `${endOffset}s`,
              },
            },
          },
        },
      ],
    },
  ]
}

function cleanYoutubeUrl(url: string): string {
  const decoded = url.replaceAll("&amp;", "&")
  try {
    const parsed = new URL(decoded)
    const host = parsed.hostname.replace(/^www\./, "")

    let videoId: string | null = null
    if (host === "youtu.be") {
      videoId = parsed.pathname.slice(1).split("/")[0] || null
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      videoId = parsed.searchParams.get("v")
      if (!videoId) {
        const match = parsed.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/)
        videoId = match?.[2] ?? null
      }
    }

    if (videoId) {
      return `https://youtu.be/${videoId}`
    }
  } catch {
    // fall through
  }
  return decoded
}

// pdf
