import { describe, expect, test, afterEach } from "bun:test"
import { tavilyExtractTool, tavilySearchTool } from "./tavily-tools"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.TRAVELY_API_KEY
})

function options() {
  return {
    abortSignal: new AbortController().signal,
  } as never
}

describe("tavily client", () => {
  test("search sends max_results 10 and forwards include_images", async () => {
    process.env.TRAVELY_API_KEY = "tvly-test"
    let body: Record<string, unknown> = {}
    globalThis.fetch = (async (_url, init) => {
      body = JSON.parse(String(init?.body))
      return new Response(
        JSON.stringify({
          results: [
            {
              title: "Example",
              url: "https://example.com",
              content: "A snippet",
              score: 0.9,
              images: [{ url: "https://example.com/a.png" }],
            },
          ],
          images: [{ url: "https://example.com/b.png" }],
        }),
        { status: 200 },
      )
    }) as typeof fetch

    const withImages = await tavilySearchTool.params.execute(
      { query: "cats", include_images: true },
      options(),
    )
    expect(body).toMatchObject({
      query: "cats",
      max_results: 10,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      include_images: true,
    })
    expect(withImages.success).toBe(true)
    expect(withImages.output).toContain("https://example.com")
    expect(withImages.output).toContain("https://example.com/a.png")
    expect(withImages.output).toContain("https://example.com/b.png")

    const withoutImages = await tavilySearchTool.params.execute(
      { query: "cats" },
      options(),
    )
    expect(body.include_images).toBe(false)
    expect(withoutImages.output).not.toContain("https://example.com/a.png")
  })

  test("extract returns results and failed_results", async () => {
    process.env.TRAVELY_API_KEY = "tvly-test"
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              url: "https://example.com/ok",
              raw_content: "Page body",
            },
          ],
          failed_results: [
            {
              url: "https://example.com/bad",
              error: "Failed to retrieve content",
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch

    const result = await tavilyExtractTool.params.execute(
      { urls: ["https://example.com/ok", "https://example.com/bad"] },
      options(),
    )
    expect(result.success).toBe(true)
    expect(result.output).toContain("Page body")
    expect(result.output).toContain("https://example.com/bad")
    expect(result.output).toContain("Failed to retrieve content")
  })

  test("a missing TRAVELY_API_KEY is a tool failure", async () => {
    delete process.env.TRAVELY_API_KEY
    const result = await tavilySearchTool.params.execute(
      { query: "cats" },
      options(),
    )
    expect(result.success).toBe(false)
    expect(result.output).toBe("TRAVELY_API_KEY is not set")
  })
})
