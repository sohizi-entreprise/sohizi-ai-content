import { beforeAll, describe, expect, it } from "vitest"
import { setPublicEnv } from "../lib/public-env"
import { buildOptimizeddImageUrl, thumbnailImageUrl } from "./transform-url"

beforeAll(() => {
  setPublicEnv({
    sentry: {
      dsn: "",
      environment: "local",
      enabled: false,
      tracesSampleRate: 0,
    },
    posthogProject: "",
    posthogApiHost: "",
    posthogApiVersion: "",
    siteUrl: "http://localhost:3000",
    mediaCdnUrl: "https://media.sohizi.com/cdn-cgi/image",
  })
})

describe("buildOptimizeddImageUrl", () => {
  const options = { width: 500 }

  it("optimizes images on the configured CDN", () => {
    expect(
      buildOptimizeddImageUrl("https://media.sohizi.com/images/a.png", options),
    ).toBe(
      "https://media.sohizi.com/cdn-cgi/image/width=500/https://media.sohizi.com/images/a.png",
    )
    expect(buildOptimizeddImageUrl("images/a.png", options)).toBe(
      "https://media.sohizi.com/cdn-cgi/image/width=500/images/a.png",
    )
  })

  it("uses the thumbnail preset for CDN images and leaves external URLs raw", () => {
    expect(
      thumbnailImageUrl("https://media.sohizi.com/images/a.png", "small"),
    ).toBe(
      "https://media.sohizi.com/cdn-cgi/image/width=500,format=webp,quality=80/https://media.sohizi.com/images/a.png",
    )
    expect(thumbnailImageUrl("https://other.example.com/reference.png")).toBe(
      "https://other.example.com/reference.png",
    )
  })

  it("preserves external and non-http image URLs", () => {
    for (const url of [
      "https://other.example.com/reference.png?size=large",
      "https://media.sohizi.com.evil.example/reference.png",
      "data:image/png;base64,abc",
      "blob:https://other.example.com/image-id",
    ]) {
      expect(buildOptimizeddImageUrl(url, options)).toBe(url)
    }
  })
})
