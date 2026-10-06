import { describe, expect, it } from "bun:test"
import { mergeAssetFileNodeMetadata } from "./file-node-metadata"

describe("mergeAssetFileNodeMetadata", () => {
  it("preserves unrelated file-node keys and copies asset details", () => {
    const fileMetadata = { status: "ready", width: 640, url: "old-url" }
    const assetMetadata = {
      size: 1024,
      contentType: "image/png",
      width: 1920,
      height: 1080,
    }
    const result = mergeAssetFileNodeMetadata(fileMetadata, {
      metadata: assetMetadata,
      url: "https://cdn.example/image.png",
      storageKey: "images/image.png",
    })

    expect(result).toEqual({
      status: "ready",
      size: 1024,
      contentType: "image/png",
      width: 1920,
      height: 1080,
      url: "https://cdn.example/image.png",
      storageKey: "images/image.png",
    })
    expect(fileMetadata).toEqual({
      status: "ready",
      width: 640,
      url: "old-url",
    })
    expect(assetMetadata).toEqual({
      size: 1024,
      contentType: "image/png",
      width: 1920,
      height: 1080,
    })
  })

  it("supports an asset with no metadata", () => {
    expect(
      mergeAssetFileNodeMetadata(null, {
        metadata: null,
        url: "https://cdn.example/video.mp4",
        storageKey: "videos/video.mp4",
      }),
    ).toEqual({
      url: "https://cdn.example/video.mp4",
      storageKey: "videos/video.mp4",
    })
  })
})
