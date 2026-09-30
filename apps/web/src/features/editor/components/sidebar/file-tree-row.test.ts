// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FileTreeRow } from "./file-tree"

afterEach(() => {
  cleanup()
})

describe("FileTreeRow", () => {
  it("overrides arborist max-content width so long names cannot expand the tree", () => {
    const { container } = render(
      createElement(FileTreeRow, {
        node: { handleClick: vi.fn() } as never,
        innerRef: vi.fn(),
        attrs: {
          style: { minWidth: "max-content", width: "100%" },
          role: "treeitem",
        },
        children: createElement("span", null, "a".repeat(200)),
      }),
    )

    const row = container.firstElementChild as HTMLElement
    expect(["0", "0px"]).toContain(row.style.minWidth)
    expect(row.style.width).toBe("100%")
    expect(row.className).toContain("overflow-hidden")
    expect(row.className).toContain("min-w-0")
  })
})
