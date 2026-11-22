import { describe, expect, it } from "bun:test"
import { createFeedbackSchema } from "./schema"

describe("createFeedbackSchema", () => {
  it("accepts valid issue and feature_request payloads with optional context", () => {
    const issue = createFeedbackSchema.parse({
      type: "issue",
      content: "  Timeline playhead jumps when splitting a clip  ",
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      metadata: {
        pageUrl:
          "https://app.sohizi.com/projects/550e8400-e29b-41d4-a716-446655440000/editor",
        userAgent: "Mozilla/5.0",
        viewport: { width: 1440, height: 900 },
      },
    })

    expect(issue.type).toBe("issue")
    expect(issue.content).toBe("Timeline playhead jumps when splitting a clip")

    const feature = createFeedbackSchema.parse({
      type: "feature_request",
      content: "Add keyboard shortcut to duplicate tracks",
    })

    expect(feature.type).toBe("feature_request")
  })

  it("rejects empty content or unknown feedback types", () => {
    expect(() =>
      createFeedbackSchema.parse({
        type: "issue",
        content: "   ",
      }),
    ).toThrow()

    expect(() =>
      createFeedbackSchema.parse({
        type: "other",
        content: "Valid text",
      }),
    ).toThrow()
  })
})
