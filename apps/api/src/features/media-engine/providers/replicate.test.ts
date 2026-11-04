import { afterEach, describe, expect, it, mock } from "bun:test"
import { ReplicateProvider } from "./replicate"
import {
  MediaAccountError,
  MediaRateLimitError,
  MediaServiceUnavailableError,
  MediaSubmissionUnknownError,
  MediaValidationError,
} from "./type"
import { createProvider, isRegisteredMediaAdapter } from "./factory"
import { applyVendorParameterMapping } from "./utils"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("Replicate adapter registration", () => {
  it("registers replicate in the media provider factory", () => {
    expect(isRegisteredMediaAdapter("replicate")).toBe(true)
    const provider = createProvider("replicate", "r8_test_token")
    expect(provider).toBeInstanceOf(ReplicateProvider)
  })
})

describe("Replicate catalog parameter and option mapping", () => {
  it("maps Nano Banana resolution, output_format, aspect_ratio, and image_input via catalog mappings", () => {
    const mapped = applyVendorParameterMapping(
      {
        prompt: "banner",
        images: ["https://example.com/in.png"],
        resolution: "0.5k",
        output_format: "jpeg",
        aspect_ratio: "auto",
      },
      [
        {
          parameter: "images",
          type: "array<string>",
          vendorParameter: "image_input",
          optionValue: null,
          vendorOption: null,
        },
        {
          parameter: "resolution",
          type: "string",
          vendorParameter: "resolution",
          optionValue: "0.5k",
          vendorOption: "512px",
        },
        {
          parameter: "output_format",
          type: "string",
          vendorParameter: "output_format",
          optionValue: "jpeg",
          vendorOption: "jpg",
        },
        {
          parameter: "aspect_ratio",
          type: "string",
          vendorParameter: "aspect_ratio",
          optionValue: "auto",
          vendorOption: "match_input_image",
        },
      ],
    )

    expect(mapped).toEqual({
      prompt: "banner",
      image_input: ["https://example.com/in.png"],
      resolution: "512px",
      output_format: "jpg",
      aspect_ratio: "match_input_image",
    })
  })
})

describe("ReplicateProvider lifecycle", () => {
  it("submits to official model predictions endpoint", async () => {
    let calledUrl = ""
    let calledBody: unknown = null

    globalThis.fetch = mock(
      async (url: string | URL | Request, init?: RequestInit) => {
        calledUrl = String(url)
        calledBody = init?.body ? JSON.parse(String(init.body)) : null
        return new Response(
          JSON.stringify({
            id: "pred_123",
            status: "starting",
            urls: { get: "https://api.replicate.com/v1/predictions/pred_123" },
          }),
          { status: 201 },
        )
      },
    ) as unknown as typeof fetch

    const provider = new ReplicateProvider("r8_secret")
    const submitted = await provider.submitRequest("kwaivgi/kling-v3-video", {
      prompt: "cinematic shot",
      duration: 5,
    })

    expect(calledUrl).toBe(
      "https://api.replicate.com/v1/models/kwaivgi/kling-v3-video/predictions",
    )
    expect(calledBody).toEqual({
      input: {
        prompt: "cinematic shot",
        duration: 5,
      },
    })
    expect(submitted).toEqual({
      requestId: "pred_123",
      status: "created",
    })
  })

  it("polls prediction statuses through starting, succeeded, and failed", async () => {
    let mockPayload: Record<string, unknown> = {
      id: "pred_123",
      status: "processing",
    }

    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify(mockPayload), { status: 200 })
    }) as unknown as typeof fetch

    const provider = new ReplicateProvider("r8_secret")

    expect(await provider.getRequestData("pred_123")).toEqual({
      status: "processing",
    })

    mockPayload = {
      id: "pred_123",
      status: "succeeded",
      output: ["https://replicate.delivery/pbxt/out.mp4"],
    }
    expect(await provider.getRequestData("pred_123")).toEqual({
      status: "completed",
      data: ["https://replicate.delivery/pbxt/out.mp4"],
    })

    mockPayload = {
      id: "pred_123",
      status: "failed",
      error: "NSFW content detected",
    }
    expect(await provider.getRequestData("pred_123")).toEqual({
      status: "error",
      error: "NSFW content detected",
    })
  })

  it("cancels an in-flight prediction", async () => {
    let cancelUrl = ""
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      cancelUrl = String(url)
      return new Response(
        JSON.stringify({ id: "pred_123", status: "canceled" }),
        { status: 200 },
      )
    }) as unknown as typeof fetch

    const provider = new ReplicateProvider("r8_secret")
    const res = await provider.cancelRequest("pred_123")
    expect(cancelUrl).toBe(
      "https://api.replicate.com/v1/predictions/pred_123/cancel",
    )
    expect(res).toEqual({ requestId: "pred_123", ok: true })
  })

  it("maps HTTP errors and network failures onto shared MediaError classes", async () => {
    const provider = new ReplicateProvider("r8_secret")

    // Network failure on submit -> MediaSubmissionUnknownError
    globalThis.fetch = mock(async () => {
      throw new TypeError("fetch failed")
    }) as unknown as typeof fetch
    await expect(
      provider.submitRequest("openai/gpt-image-2", { prompt: "hi" }),
    ).rejects.toBeInstanceOf(MediaSubmissionUnknownError)

    // 429 with retry_after JSON body -> MediaRateLimitError with retryAfterMs
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ detail: "Request was throttled", retry_after: 6 }),
        { status: 429 },
      )
    }) as unknown as typeof fetch
    try {
      await provider.submitRequest("openai/gpt-image-2", { prompt: "hi" })
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(MediaRateLimitError)
      expect((err as MediaRateLimitError).retryAfterMs).toBe(6000)
    }

    // 422 Unprocessable Entity -> MediaValidationError
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ detail: "Invalid input parameter" }),
        { status: 422 },
      )
    }) as unknown as typeof fetch
    await expect(
      provider.submitRequest("openai/gpt-image-2", { prompt: "hi" }),
    ).rejects.toBeInstanceOf(MediaValidationError)

    // 402 Payment Required -> MediaAccountError
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ detail: "Billing required" }), {
        status: 402,
      })
    }) as unknown as typeof fetch
    await expect(
      provider.submitRequest("openai/gpt-image-2", { prompt: "hi" }),
    ).rejects.toBeInstanceOf(MediaAccountError)

    // 503 Service Unavailable -> MediaServiceUnavailableError
    globalThis.fetch = mock(async () => {
      return new Response("Upstream unavailable", { status: 503 })
    }) as unknown as typeof fetch
    await expect(provider.getRequestData("pred_123")).rejects.toBeInstanceOf(
      MediaServiceUnavailableError,
    )
  })
})
