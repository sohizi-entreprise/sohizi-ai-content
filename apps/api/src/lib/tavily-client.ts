import { parseRetryAfterHeader } from "@/features/capacity/retry-after"

const TAVILY_URL = "https://api.tavily.com"
const EXTRACT_CONTENT_LIMIT = 8_000

type SearchImage = string | { url?: string; description?: string }

type SearchResult = {
  title?: string
  url?: string
  content?: string
  score?: number
  images?: SearchImage[]
}

type SearchResponse = {
  results?: SearchResult[]
  images?: SearchImage[]
}

type ExtractResult = {
  url?: string
  raw_content?: string
}

type ExtractFailure = {
  url?: string
  error?: string
}

type ExtractResponse = {
  results?: ExtractResult[]
  failed_results?: ExtractFailure[]
}

export type TavilySearchInput = {
  query: string
  include_images?: boolean
}

export type TavilyExtractInput = {
  urls: string[]
  query?: string
}

export class TavilyRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "TavilyRequestError"
  }
}

export class TavilyHttpError extends TavilyRequestError {
  readonly retryAfterMs?: number

  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message, status)
    this.name = "TavilyHttpError"
    this.retryAfterMs = retryAfterMs
  }
}

function imageUrl(image: SearchImage): string | undefined {
  if (typeof image === "string") return image
  return image.url
}

function formatImages(images: SearchImage[] | undefined): string[] {
  const urls: string[] = []
  for (const image of images ?? []) {
    const url = imageUrl(image)
    if (url && !urls.includes(url)) urls.push(url)
  }
  return urls
}

async function tavilyPost<T>(
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (!apiKey) {
    throw new TavilyRequestError("Tavily API key is not set")
  }

  let response: Response
  try {
    response = await fetch(`${TAVILY_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new TavilyRequestError(
      error instanceof Error ? error.message : "Tavily request failed",
    )
  }

  if (!response.ok) {
    const text = await response.text()
    throw new TavilyHttpError(
      response.status,
      `Tavily ${path} failed (${response.status}): ${text.slice(0, 300)}`,
      parseRetryAfterHeader(response.headers.get("retry-after") ?? ""),
    )
  }

  return (await response.json()) as T
}

export async function tavilySearch(
  apiKey: string,
  input: TavilySearchInput,
  signal?: AbortSignal,
): Promise<string> {
  const includeImages = input.include_images === true
  const data = await tavilyPost<SearchResponse>(
    apiKey,
    "/search",
    {
      query: input.query,
      max_results: 10,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      include_images: includeImages,
    },
    signal,
  )

  const results = data.results ?? []
  if (results.length === 0) {
    return `No results for "${input.query}".`
  }

  const lines = results.map((result, index) => {
    const parts = [
      `${index + 1}. ${result.title || "Untitled"}`,
      `URL: ${result.url || ""}`,
      `Score: ${result.score ?? ""}`,
      result.content || "",
    ]
    if (includeImages) {
      const images = formatImages(result.images)
      if (images.length > 0) {
        parts.push(`Images:\n${images.map((url) => `- ${url}`).join("\n")}`)
      }
    }
    return parts.filter(Boolean).join("\n")
  })

  if (includeImages) {
    const images = formatImages(data.images)
    if (images.length > 0) {
      lines.push(`Images:\n${images.map((url) => `- ${url}`).join("\n")}`)
    }
  }

  return lines.join("\n\n")
}

function capContent(content: string): string {
  if (content.length <= EXTRACT_CONTENT_LIMIT) return content
  return `${content.slice(0, EXTRACT_CONTENT_LIMIT)}\n[truncated]`
}

export async function tavilyExtract(
  apiKey: string,
  input: TavilyExtractInput,
  signal?: AbortSignal,
): Promise<string> {
  const body: Record<string, unknown> = {
    urls: input.urls,
    extract_depth: "basic",
    format: "markdown",
  }
  if (input.query) {
    body.query = input.query
    body.chunks_per_source = 3
  }

  const data = await tavilyPost<ExtractResponse>(
    apiKey,
    "/extract",
    body,
    signal,
  )
  const sections: string[] = []

  for (const result of data.results ?? []) {
    const content = capContent(result.raw_content || "")
    sections.push(`# ${result.url || "unknown"}\n${content}`)
  }

  const failed = data.failed_results ?? []
  if (failed.length > 0) {
    sections.push(
      `Failed:\n${failed
        .map((item) => `- ${item.url || "unknown"}: ${item.error || "failed"}`)
        .join("\n")}`,
    )
  }

  if (sections.length === 0) {
    return "Extract returned no content."
  }
  return sections.join("\n\n")
}
