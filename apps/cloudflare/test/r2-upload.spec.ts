import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import worker from "../src/index"
import { createTestEnv } from "./fakes"

const UPLOAD_URL = "https://worker.test/v1/upload-r2-from-url"

function uploadRequest(
  body: unknown,
  authorization = "Bearer test-token",
): Request {
  return new Request(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function setup() {
  return createTestEnv({
    CLOUDFLARE_WORKER_TOKEN: "test-token",
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("R2 upload-from-url route", () => {
  it("requires bearer authentication", async () => {
    const { env } = setup()
    const response = await worker.fetch(
      uploadRequest(
        { sourceUrl: "https://cdn.example.com/a.png" },
        "Bearer bad",
      ),
      env,
    )
    expect(response.status).toBe(401)
  })

  it("streams an external URL into R2 and classifies the asset folder", async () => {
    const { bucket, env } = setup()
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(bytes, {
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": String(bytes.byteLength),
          },
        }),
      ),
    )

    const response = await worker.fetch(
      uploadRequest({ sourceUrl: "https://cdn.example.com/outputs/clip.mp4" }),
      env,
    )
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      url: string
      storageKey: string
      size: number
      contentType: string
      type: string
    }
    expect(body.storageKey).toMatch(/^videos\/[0-9a-f-]{36}\/clip\.mp4$/)
    expect(body.url).toBe(`https://media-dev.sohizi.com/${body.storageKey}`)
    expect(body.size).toBe(6)
    expect(body.contentType).toBe("video/mp4")
    expect(body.type).toBe("video")
    expect(bucket.objects.get(body.storageKey)).toEqual(bytes)
  })

  it("uses custom destinationPath when provided", async () => {
    const { bucket, env } = setup()
    const bytes = new Uint8Array([10, 20, 30])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(bytes, {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      ),
    )

    const response = await worker.fetch(
      uploadRequest({
        sourceUrl: "https://cdn.example.com/photo.png",
        destinationPath: "images/custom-id/photo.png",
      }),
      env,
    )
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      url: string
      storageKey: string
      size: number
    }
    expect(body.storageKey).toBe("images/custom-id/photo.png")
    expect(body.url).toBe(
      "https://media-dev.sohizi.com/images/custom-id/photo.png",
    )
    expect(body.size).toBe(3)
    expect(bucket.objects.get("images/custom-id/photo.png")).toEqual(bytes)
  })

  it("rejects invalid sourceUrl or path traversal destinationPath", async () => {
    const { env } = setup()

    const badUrl = await worker.fetch(
      uploadRequest({ sourceUrl: "ftp://cdn.example.com/file.png" }),
      env,
    )
    expect(badUrl.status).toBe(400)

    const badDest = await worker.fetch(
      uploadRequest({
        sourceUrl: "https://cdn.example.com/file.png",
        destinationPath: "../secret.png",
      }),
      env,
    )
    expect(badDest.status).toBe(400)
  })

  it("infers MIME type and folder from URL extension when upstream sends application/octet-stream", async () => {
    const { bucket, env } = setup()
    const bytes = new Uint8Array([9, 8, 7, 6])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(bytes, {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        }),
      ),
    )

    const response = await worker.fetch(
      uploadRequest({
        sourceUrl: "https://cdn.example.com/generations/song.mp3?token=abc",
      }),
      env,
    )
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      storageKey: string
      contentType: string
      type: string
      size: number
    }
    expect(body.storageKey).toMatch(/^audios\/[0-9a-f-]{36}\/song\.mp3$/)
    expect(body.contentType).toBe("audio/mpeg")
    expect(body.type).toBe("audio")
    expect(body.size).toBe(4)
    expect(bucket.objects.get(body.storageKey)).toEqual(bytes)
  })

  it("returns 502 when upstream fetch fails", async () => {
    const { env } = setup()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })),
    )

    const response = await worker.fetch(
      uploadRequest({ sourceUrl: "https://cdn.example.com/missing.png" }),
      env,
    )
    expect(response.status).toBe(502)
  })
})
