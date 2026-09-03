import { describe, expect, it } from "bun:test"
import { buildInvokedCommandsPrompt, extractCommandNames } from "./resolve"

describe("command resolve", () => {
  it("extracts command names from markdown", () => {
    expect(
      extractCommandNames("Please #[command=summarize] this text"),
    ).toEqual(["summarize"])
    expect(
      extractCommandNames("#[command=proofread] and #[command=translate]"),
    ).toEqual(["proofread", "translate"])
  })

  it("builds invoked commands prompt", () => {
    const prompt = buildInvokedCommandsPrompt([
      { name: "summarize", action: "Summarize clearly." },
    ])

    expect(prompt).toContain("<invoked-commands>")
    expect(prompt).toContain("/summarize: Summarize clearly.")
  })
})
