import { afterEach, describe, expect, it } from "bun:test"
import { getUploadUrlSchema } from "./schema"
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  VIDEO_MAX_UPLOAD_BYTES,
  buildCanonicalSignedHeaders,
  generateSignedUploadUrl,
  getMaxUploadSizeInBytes,
  signPutObjectUrl,
} from "./storage"

const R2_ENV_KEYS = [
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const

const originalR2Env = Object.fromEntries(
  R2_ENV_KEYS.map((key) => [key, process.env[key]]),
)

afterEach(() => {
  for (const key of R2_ENV_KEYS) {
    const value = originalR2Env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe("upload size policy", () => {
  it("allows videos up to 250 MiB and every other type up to 15 MiB", () => {
    expect(getMaxUploadSizeInBytes("video/mp4")).toBe(VIDEO_MAX_UPLOAD_BYTES)
    expect(getMaxUploadSizeInBytes("video/webm")).toBe(250 * 1024 * 1024)
    expect(getMaxUploadSizeInBytes("audio/mpeg")).toBe(DEFAULT_MAX_UPLOAD_BYTES)
    expect(getMaxUploadSizeInBytes("image/png")).toBe(DEFAULT_MAX_UPLOAD_BYTES)
    expect(getMaxUploadSizeInBytes("application/pdf")).toBe(
      DEFAULT_MAX_UPLOAD_BYTES,
    )
    expect(VIDEO_MAX_UPLOAD_BYTES).toBe(250 * 1024 * 1024)
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(15 * 1024 * 1024)
  })

  it("rejects a file one byte above either limit before signing", async () => {
    await expect(
      generateSignedUploadUrl(
        "clip.mp4",
        "video/mp4",
        VIDEO_MAX_UPLOAD_BYTES + 1,
      ),
    ).rejects.toThrow("File exceeds the maximum allowed size")
    await expect(
      generateSignedUploadUrl(
        "photo.png",
        "image/png",
        DEFAULT_MAX_UPLOAD_BYTES + 1,
      ),
    ).rejects.toThrow("File exceeds the maximum allowed size")
  })

  it("signs the exact approved length and content type", async () => {
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com"
    process.env.R2_ACCESS_KEY_ID = "test-access-key"
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key"
    process.env.R2_BUCKET_NAME = "test-bucket"

    const video = await generateSignedUploadUrl(
      "clip.mp4",
      "video/mp4",
      VIDEO_MAX_UPLOAD_BYTES,
    )
    const image = await generateSignedUploadUrl(
      "photo.png",
      "image/png",
      DEFAULT_MAX_UPLOAD_BYTES,
    )

    expect(new URL(video.url).searchParams.get("X-Amz-SignedHeaders")).toBe(
      "content-length;content-type;host",
    )
    expect(new URL(image.url).searchParams.get("X-Amz-SignedHeaders")).toBe(
      "content-length;content-type;host",
    )
    expect(
      buildCanonicalSignedHeaders("example.r2.cloudflarestorage.com", {
        "content-length": String(VIDEO_MAX_UPLOAD_BYTES),
        "content-type": "video/mp4",
      }).canonicalHeaders,
    ).toBe(
      [
        `content-length:${VIDEO_MAX_UPLOAD_BYTES}`,
        "content-type:video/mp4",
        "host:example.r2.cloudflarestorage.com",
        "",
      ].join("\n"),
    )
    expect(
      buildCanonicalSignedHeaders("example.r2.cloudflarestorage.com", {
        "content-length": String(DEFAULT_MAX_UPLOAD_BYTES),
        "content-type": "image/png",
      }).canonicalHeaders,
    ).toContain(`content-length:${DEFAULT_MAX_UPLOAD_BYTES}\n`)

    const now = new Date("2026-10-21T16:10:41.000Z")
    const base = {
      endpoint: "https://example.r2.cloudflarestorage.com",
      bucket: "test-bucket",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      storageKey: "videos/fixed/clip.mp4",
      contentType: "video/mp4",
      now,
    }
    const exact = new URL(signPutObjectUrl({ ...base, contentLength: 11 }))
    const longer = new URL(signPutObjectUrl({ ...base, contentLength: 12 }))
    expect(exact.searchParams.get("X-Amz-Signature")).not.toBe(
      longer.searchParams.get("X-Amz-Signature"),
    )
    expect(signPutObjectUrl({ ...base, contentLength: 11 })).toBe(
      signPutObjectUrl({ ...base, contentLength: 11 }),
    )
  })
})

describe("getUploadUrlSchema", () => {
  it("accepts the size boundaries and rejects missing or non-integer lengths", () => {
    expect(
      getUploadUrlSchema.safeParse({
        fileName: "clip.mp4",
        contentType: "video/mp4",
        contentLength: String(VIDEO_MAX_UPLOAD_BYTES),
      }).success,
    ).toBe(true)
    expect(
      getUploadUrlSchema.safeParse({
        fileName: "photo.png",
        contentType: "image/png",
        contentLength: DEFAULT_MAX_UPLOAD_BYTES,
      }).success,
    ).toBe(true)
    expect(
      getUploadUrlSchema.safeParse({
        fileName: "photo.png",
        contentType: "image/png",
        contentLength: "0",
      }).success,
    ).toBe(true)

    for (const contentLength of [undefined, "-1", "1.5", "nope"]) {
      expect(
        getUploadUrlSchema.safeParse({
          fileName: "photo.png",
          contentType: "image/png",
          contentLength,
        }).success,
      ).toBe(false)
    }
  })
})
