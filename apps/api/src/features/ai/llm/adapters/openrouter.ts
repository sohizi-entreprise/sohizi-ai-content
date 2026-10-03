import { createDownload, type Experimental_DownloadFunction } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  generateWithModel,
  openRouterCost,
  openRouterProviderOptions,
  streamWithModel,
} from "../call"
import type {
  LlmAdapter,
  LlmCallInput,
  LlmStream,
  LlmTextResult,
} from "../types"

const fetchUnsupportedUrl = createDownload()

function isYoutubeUrl(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, "").toLowerCase()
  return (
    host === "youtu.be" ||
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  )
}

const passthroughOpenRouterMedia: Experimental_DownloadFunction = async (
  downloads,
) => {
  return Promise.all(
    downloads.map(async ({ url, isUrlSupportedByModel }) => {
      if (isUrlSupportedByModel || isYoutubeUrl(url)) {
        return null
      }
      return fetchUnsupportedUrl({ url })
    }),
  )
}

const providers = new Map<string, ReturnType<typeof createOpenRouter>>()

function providerFor(apiKey: string) {
  const cached = providers.get(apiKey)
  if (cached) return cached
  const provider = createOpenRouter({ apiKey })
  providers.set(apiKey, provider)
  return provider
}

function withVideoUrlSupport<
  T extends { supportedUrls?: Record<string, RegExp[]> },
>(model: T): T {
  const urls = model.supportedUrls ?? (model.supportedUrls = {})
  if (!urls["video/*"]?.length) {
    urls["video/*"] = [/^https?:\/\/.+/i, /^data:video\//i]
  }
  return model
}

export class OpenRouterAdapter implements LlmAdapter {
  readonly name = "openrouter"

  constructor(private readonly apiKey: string) {}

  private model(apiName: string) {
    return withVideoUrlSupport(providerFor(this.apiKey)(apiName))
  }

  generateText(input: LlmCallInput): Promise<LlmTextResult> {
    return generateWithModel(this.model(input.apiName), input, {
      download: passthroughOpenRouterMedia,
      providerOptions: openRouterProviderOptions(input),
      costFrom: openRouterCost,
    })
  }

  streamText(input: LlmCallInput): LlmStream {
    return streamWithModel(this.model(input.apiName), input, {
      download: passthroughOpenRouterMedia,
      providerOptions: openRouterProviderOptions(input),
      costFrom: openRouterCost,
    })
  }
}
