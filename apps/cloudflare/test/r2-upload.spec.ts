import { describe, expect, it } from "vitest"
import { uploadStreamToR2 } from "../src/render/r2-upload"
import { FakeR2Bucket } from "./fakes"

function streamOf(chunks: Array<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

describe("uploadStreamToR2", () => {
  it("uploads a small render as a single part", async () => {
    const bucket = new FakeR2Bucket()
    const payload = new Uint8Array(1024).fill(7)

    const result = await uploadStreamToR2(
      bucket as unknown as R2Bucket,
      "renders/p/j.mp4",
      streamOf([payload]),
      { contentType: "video/mp4" },
    )

    expect(result.sizeInBytes).toBe(1024)
    expect(bucket.multipartUploads[0].parts).toBe(1)
    expect(bucket.objects.get("renders/p/j.mp4")?.byteLength).toBe(1024)
  })

  it("splits a large render into parts", async () => {
    const bucket = new FakeR2Bucket()
    // Three chunks of 5 MiB force at least two parts at the 8 MiB threshold.
    const chunk = new Uint8Array(5 * 1024 * 1024).fill(1)

    const result = await uploadStreamToR2(
      bucket as unknown as R2Bucket,
      "renders/p/j.mp4",
      streamOf([chunk, chunk, chunk]),
      { contentType: "video/mp4" },
    )

    expect(result.sizeInBytes).toBe(15 * 1024 * 1024)
    expect(bucket.multipartUploads).toHaveLength(1)
    expect(bucket.multipartUploads[0].parts).toBeGreaterThan(1)
    expect(bucket.objects.get("renders/p/j.mp4")?.byteLength).toBe(
      15 * 1024 * 1024,
    )
  })

  it("aborts the multipart upload when the source stream fails", async () => {
    const bucket = new FakeR2Bucket()
    const failing = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16))
        controller.error(new Error("container went away"))
      },
    })

    await expect(
      uploadStreamToR2(
        bucket as unknown as R2Bucket,
        "renders/p/j.mp4",
        failing,
        {
          contentType: "video/mp4",
        },
      ),
    ).rejects.toThrow("container went away")

    expect(bucket.multipartUploads[0].aborted).toBe(true)
    expect(bucket.objects.has("renders/p/j.mp4")).toBe(false)
  })

  it("rejects an empty render instead of storing a broken file", async () => {
    const bucket = new FakeR2Bucket()

    await expect(
      uploadStreamToR2(
        bucket as unknown as R2Bucket,
        "renders/p/j.mp4",
        streamOf([]),
        {
          contentType: "video/mp4",
        },
      ),
    ).rejects.toThrow("empty render")

    expect(bucket.multipartUploads[0].aborted).toBe(true)
    expect(bucket.objects.has("renders/p/j.mp4")).toBe(false)
  })
})
