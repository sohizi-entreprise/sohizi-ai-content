import { z } from "zod"

const searchWebSchema = z
  .object({
    endpoint: z.literal("/web/search"),
    method: z.literal("GET"),
    params: z.object({
      query: z.string().describe("The search query."),
      include_images: z
        .boolean()
        .optional()
        .describe("Include image URLs in the results."),
    }),
  })
  .describe(
    "Search the web for up-to-date information. Returns titles, URLs, and brief text snippets.",
  )

const extractWebSchema = z
  .object({
    endpoint: z.literal("/web/extract"),
    method: z.literal("POST"),
    body: z.object({
      urls: z
        .array(z.string())
        .min(1)
        .max(20)
        .describe("One to twenty URLs to extract."),
      query: z
        .string()
        .optional()
        .describe(
          "Optional intent used to rerank extracted chunks toward the most relevant passages.",
        ),
    }),
  })
  .describe(
    "Extract full webpage content as clean Markdown from provided URLs. Use when search snippets lack sufficient detail or when given a direct link.",
  )

export const apiWebSchema = [searchWebSchema, extractWebSchema]

export type ApiWebRequest = z.infer<(typeof apiWebSchema)[number]>
