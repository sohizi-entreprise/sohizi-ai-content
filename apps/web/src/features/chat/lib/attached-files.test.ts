import { describe, expect, it } from "vitest"
import { buildUserFileParts, partitionAttachedFiles } from "./attached-files"
import type { AttachedFile } from "@/components/widgets/file-attachments"

function uploaded(type: string, url: string): AttachedFile {
  return { status: "uploaded", id: url, type, url }
}

describe("partitionAttachedFiles", () => {
  it("loads images, pdfs, and plain text, and leaves video and audio available", () => {
    const { loadedFiles, availableFiles } = partitionAttachedFiles([
      uploaded("image/png", "https://cdn.example/shot.png"),
      uploaded("video/mp4", "https://cdn.example/clip.mp4"),
      { status: "pending", id: "pending", type: "image/png" },
      uploaded("application/pdf", "https://cdn.example/notes.pdf"),
      uploaded("audio/mpeg", "https://cdn.example/voice.mp3"),
      uploaded("text/plain", "https://cdn.example/notes.txt"),
    ])

    expect(
      loadedFiles.map((file) => [
        file.messagePartIndex,
        file.userIndex,
        file.type,
      ]),
    ).toEqual([
      [1, 1, "image"],
      [3, 3, "pdf"],
      [5, 5, "text"],
    ])
    expect(availableFiles.map((file) => [file.userIndex, file.type])).toEqual([
      [2, "video"],
      [4, "audio"],
    ])
    expect(loadedFiles[1]?.mediaType).toBe("application/pdf")
    expect(availableFiles[0]?.mediaType).toBe("video/mp4")
  })
})

describe("buildUserFileParts", () => {
  it("keeps the user's order when a video sits between an image and a pdf", () => {
    const files = [
      uploaded("image/png", "https://cdn.example/shot.png"),
      uploaded("video/mp4", "https://cdn.example/clip.mp4"),
      uploaded("application/pdf", "https://cdn.example/notes.pdf"),
    ]

    const parts = buildUserFileParts(files)

    expect(parts.map(describePart)).toEqual([
      ["image", "https://cdn.example/shot.png"],
      ["file", "video/mp4", "https://cdn.example/clip.mp4"],
      ["file", "application/pdf", "https://cdn.example/notes.pdf"],
    ])
    const partitioned = partitionAttachedFiles(files)
    expect(partitioned.loadedFiles.map((file) => file.messagePartIndex)).toEqual(
      [1, 3],
    )
    expect(partitioned.loadedFiles.map((file) => file.userIndex)).toEqual([
      1, 3,
    ])
    expect(partitioned.availableFiles.map((file) => file.userIndex)).toEqual([
      2,
    ])
  })
})

function describePart(part: ReturnType<typeof buildUserFileParts>[number]) {
  if (part.type === "image") return ["image", String(part.image)]
  return ["file", part.mediaType, String(part.data)]
}
