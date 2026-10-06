import { describe, expect, it } from "bun:test"
import {
  decodeDirectoryChildCursor,
  encodeDirectoryChildCursor,
  previewUrlForChild,
  sliceDirectoryChildrenPage,
} from "./directory-children"

describe("directory child cursor", () => {
  it("round-trips position and id, including a negative position", () => {
    const cursor = {
      position: -1000,
      id: "3f1c0c4e-6a1d-4d7a-9c2e-1b7a6d0e9f11",
    }
    expect(
      decodeDirectoryChildCursor(encodeDirectoryChildCursor(cursor)),
    ).toEqual(cursor)
  })

  it("rejects cursors that are not position:id", () => {
    expect(decodeDirectoryChildCursor("nope")).toBeNull()
    expect(decodeDirectoryChildCursor("1.5:abc")).toBeNull()
    expect(decodeDirectoryChildCursor(":abc")).toBeNull()
    expect(decodeDirectoryChildCursor("10:")).toBeNull()
  })
})

describe("sliceDirectoryChildrenPage", () => {
  const rows = [
    { position: 1000, id: "a" },
    { position: 2000, id: "b" },
    { position: 3000, id: "c" },
  ]

  it("sets hasMore and cursors the last kept row when an extra row was fetched", () => {
    const page = sliceDirectoryChildrenPage(rows, 2)

    expect(page.hasMore).toBe(true)
    expect(page.data).toEqual(rows.slice(0, 2))
    expect(page.nextCursor).toBe("2000:b")
    expect(decodeDirectoryChildCursor(page.nextCursor ?? "")).toEqual({
      position: 2000,
      id: "b",
    })
  })

  it("returns every row and no cursor when the page is not full", () => {
    const page = sliceDirectoryChildrenPage(rows, 3)

    expect(page.hasMore).toBe(false)
    expect(page.data).toEqual(rows)
    expect(page.nextCursor).toBeNull()
  })
})

describe("previewUrlForChild", () => {
  it("keeps a url for images and videos only", () => {
    expect(previewUrlForChild("image", "https://cdn/a.png")).toBe(
      "https://cdn/a.png",
    )
    expect(previewUrlForChild("video", "https://cdn/a.mp4")).toBe(
      "https://cdn/a.mp4",
    )
    expect(previewUrlForChild("document", "https://cdn/a.png")).toBeNull()
    expect(previewUrlForChild("image", null)).toBeNull()
  })
})
