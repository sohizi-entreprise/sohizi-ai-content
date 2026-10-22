import { describe, expect, it } from "bun:test"
import { buildEditorContextPrompt, editorContextSchema } from "./editor-context"

describe("buildEditorContextPrompt", () => {
  it("includes local time and distinguishes message-part indexes from user order", () => {
    const prompt = buildEditorContextPrompt({
      focusedTab: null,
      openTabs: [],
      selections: [],
      localTime: "2026-10-21T20:43:00.000+03:00",
      timeZone: "Africa/Nairobi",
      loadedFiles: [
        {
          messagePartIndex: 1,
          userIndex: 1,
          type: "image",
          mediaType: "image/png",
          url: "https://cdn.example/shot.png",
        },
        {
          messagePartIndex: 3,
          userIndex: 3,
          type: "pdf",
          mediaType: "application/pdf",
          url: "https://cdn.example/notes.pdf",
        },
      ],
      availableFiles: [
        {
          userIndex: 2,
          type: "video",
          mediaType: "video/mp4",
          url: "https://cdn.example/clip.mp4",
        },
        {
          userIndex: 4,
          type: "audio",
          mediaType: "audio/mpeg",
          url: "https://cdn.example/voice.mp3",
        },
      ],
    })

    expect(prompt).toContain(
      '<user_local_time timezone="Africa/Nairobi">2026-10-21T20:43:00.000+03:00</user_local_time>',
    )
    expect(prompt).toContain(
      "message_part_index is that part's position in the user message content. Index 0 is the text.",
    )
    expect(prompt).toContain(
      "user_index is the 1-based order of uploaded attachments as the user sees them.",
    )
    expect(prompt).toContain(
      '<loaded_file message_part_index="1" user_index="1" type="image" media_type="image/png" url="https://cdn.example/shot.png" />',
    )
    expect(prompt).toContain(
      '<loaded_file message_part_index="3" user_index="3" type="pdf" media_type="application/pdf" url="https://cdn.example/notes.pdf" />',
    )
    expect(prompt).toContain(
      '<available_file user_index="2" type="video" media_type="video/mp4" url="https://cdn.example/clip.mp4" />',
    )
    expect(prompt).toContain(
      '<available_file user_index="4" type="audio" media_type="audio/mpeg" url="https://cdn.example/voice.mp3" />',
    )
    expect(prompt.indexOf("<user_local_time")).toBeLessThan(
      prompt.indexOf("<attached_files>"),
    )
  })

  it("defaults missing attachment fields when parsing older payloads", () => {
    const parsed = editorContextSchema.parse({
      focusedTab: null,
      openTabs: [],
      selections: [],
    })

    expect(parsed.localTime).toBe("")
    expect(parsed.timeZone).toBe("")
    expect(parsed.loadedFiles).toEqual([])
    expect(parsed.availableFiles).toEqual([])
    expect(buildEditorContextPrompt(parsed)).toBe("")
  })
})
