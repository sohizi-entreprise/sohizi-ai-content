import { z } from "zod"

const mediaGenerationTypes = [
  "text-to-image",
  "image-to-image",
  "text-to-video",
  "image-to-video",
  "video-to-video",
  "text-to-speech",
  "music-generation",
  // "voice-control",
  // "motion-transfer",
  "lip-sync",
  "image-upscaler",
  "video-upscaler",
] as const

const listModelsSchema = z
  .object({
    endpoint: z.literal("/media/models"),
    method: z.literal("GET"),
    params: z.object({
      type: z
        .enum(mediaGenerationTypes)
        .describe("The type of media-generation request."),
    }),
  })
  .describe("List models available for a media-generation type.")

const getModelSchema = z
  .object({
    endpoint: z.literal("/media/models/schema"),
    method: z.literal("GET"),
    params: z.object({
      modelId: z.string().describe("The ID of the generation model."),
    }),
  })
  .describe("Get the parameter schema for a media-generation model.")

const imageAnalysisSchema = z
  .object({
    endpoint: z.literal("/media/analyze/image"),
    method: z.literal("POST"),
    body: z.object({
      url: z.url().describe("The URL of the image to analyze."),
      instructions: z.string().describe("Instructions for the analysis."),
    }),
  })
  .describe("Analyze an image by URL.")

const videoAnalysisSchema = z
  .object({
    endpoint: z.literal("/media/analyze/video"),
    method: z.literal("POST"),
    body: z.object({
      url: z.url().describe("The URL of the video to analyze."),
      contentType: z
        .string()
        .describe("The media content type, for example video/mp4."),
      instructions: z.string().describe("Instructions for the analysis."),
      startSeconds: z
        .number()
        .optional()
        .describe("Optional start time in seconds."),
      endSeconds: z
        .number()
        .optional()
        .describe("Optional end time in seconds."),
    }),
  })
  .describe("Analyze a video file by URL.")

const youtubeAnalysisSchema = z
  .object({
    endpoint: z.literal("/media/analyze/youtube"),
    method: z.literal("POST"),
    body: z.object({
      url: z.url().describe("The URL of the YouTube video to analyze."),
      instructions: z.string().describe("Instructions for the analysis."),
      startSeconds: z
        .number()
        .optional()
        .describe("Optional start time in seconds."),
      endSeconds: z
        .number()
        .optional()
        .describe("Optional end time in seconds."),
    }),
  })
  .describe("Analyze a YouTube video by URL.")

const youtubeScreenshotSchema = z
  .object({
    endpoint: z.literal("/media/extract-frame/youtube"),
    method: z.literal("POST"),
    body: z.object({
      youtubeUrl: z.url().describe("The URL of the YouTube video to capture."),
      seconds: z
        .number()
        .int()
        .min(0)
        .max(86400)
        .optional()
        .describe("Time to capture in seconds."),
    }),
  })
  .describe("Extract a frame from a YouTube video at the requested time.")

const submitGenerationSchema = z
  .object({
    endpoint: z.literal("/media/assets/generate"),
    method: z.literal("POST"),
    body: z.object({
      kind: z.enum(["image", "video", "audio", "speech"]),
      label: z
        .string()
        .describe("A short label identifying the generated asset."),
      modelId: z.string().describe("The ID of the generation model to use."),
      parameters: z
        .record(z.string(), z.unknown())
        .describe("Model-specific generation parameters."),
    }),
  })
  .describe("Submit an asynchronous media-generation job.")

const saveAssetSchema = z
  .object({
    endpoint: z.literal("/media/assets/save"),
    method: z.literal("POST"),
    body: z.object({
      fileName: z.string().min(1).describe("The name for the file to create."),
      directoryPath: z
        .string()
        .describe(
          "The destination directory path where the asset file will be saved.",
        ),
      assetId: z
        .uuid()
        .describe("The ID of the generated or existing asset to save."),
    }),
  })
  .describe("Save an asset as a file in a project directory.")

const waitForJobSchema = z
  .object({
    endpoint: z.literal("/media/jobs/wait"),
    method: z.literal("POST"),
    body: z.object({
      jobId: z.string().describe("The job ID returned by media generation."),
    }),
  })
  .describe("Wait for a submitted media-generation job to finish.")

const getJobStatusSchema = z
  .object({
    endpoint: z.literal("/media/jobs/status"),
    method: z.literal("GET"),
    params: z.object({
      jobId: z.string().describe("The job ID returned by media generation."),
    }),
  })
  .describe(
    "Get the status of a submitted media-generation job without waiting.",
  )

export const apiMediaOperationsSchema = [
  listModelsSchema,
  getModelSchema,
  imageAnalysisSchema,
  videoAnalysisSchema,
  youtubeAnalysisSchema,
  youtubeScreenshotSchema,
  submitGenerationSchema,
  saveAssetSchema,
  waitForJobSchema,
  getJobStatusSchema,
]

export type ApiMediaOperationsRequest = z.infer<
  (typeof apiMediaOperationsSchema)[number]
>
