import { describe, expect, test } from "bun:test"
import { createLlmAdapter } from "./factory"

describe("createLlmAdapter", () => {
  test("uses the capacity account credential, not the vendor name", () => {
    const adapter = createLlmAdapter(
      "vercel-gateway",
      "vercel-gateway",
      "account-credential",
    )

    expect((adapter as unknown as { apiKey: string }).apiKey).toBe(
      "account-credential",
    )
  })
})
