import { describe, expect, it } from "vitest"
import { buildGenerationPayload } from "./generation-payload"

describe("buildGenerationPayload", () => {
  it("maps the selected model and media type into the estimate payload", () => {
    expect(
      buildGenerationPayload({
        selectedModelId: "sync/lipsync-3",
        parameterValues: { video: "https://cdn.example.com/clip.mp4" },
        parameters: [],
        generationType: "lip-sync",
        generationSubtype: null,
      }),
    ).toEqual({
      model: "sync/lipsync-3",
      settings: { video: "https://cdn.example.com/clip.mp4" },
      context: {
        model: "sync/lipsync-3",
        mediaType: "video",
        generationType: "lip-sync",
        subtype: null,
        referencedFiles: [],
      },
    })
  })
})
