import { beforeEach, describe, expect, it } from "vitest"
import {
  latestRunModelId,
  readSelectedModelId,
  resolveChatModel,
  writeSelectedModelId,
} from "./selected-model"
import type { LlmModel } from "../types"

const models: Array<LlmModel> = [
  { id: "openai/gpt-5.1", provider: "openai", name: "GPT-5.1" },
  { id: "anthropic/claude", provider: "anthropic", name: "Claude" },
  { id: "google/gemini", provider: "google", name: "Gemini" },
]

describe("latestRunModelId", () => {
  it("reads the model from the last run", () => {
    expect(
      latestRunModelId([
        { metadata: { usage: { modelId: "openai/gpt-5.1" } } },
        { metadata: { usage: { modelId: "anthropic/claude" } } },
      ]),
    ).toBe("anthropic/claude")
  })

  it("returns null when the last run has no model", () => {
    expect(
      latestRunModelId([
        { metadata: { usage: { modelId: "openai/gpt-5.1" } } },
        { metadata: {} },
      ]),
    ).toBeNull()
  })

  it("returns null when there are no runs", () => {
    expect(latestRunModelId([])).toBeNull()
  })
})

describe("resolveChatModel", () => {
  it("prefers the run model over storage and the default", () => {
    expect(
      resolveChatModel(models, {
        runModelId: "google/gemini",
        storedModelId: "anthropic/claude",
      })?.id,
    ).toBe("google/gemini")
  })

  it("uses storage when the run model is missing from the catalog", () => {
    expect(
      resolveChatModel(models, {
        runModelId: "missing/model",
        storedModelId: "anthropic/claude",
      })?.id,
    ).toBe("anthropic/claude")
  })

  it("uses storage when the run has no model", () => {
    expect(
      resolveChatModel(models, {
        runModelId: null,
        storedModelId: "anthropic/claude",
      })?.id,
    ).toBe("anthropic/claude")
  })

  it("falls back to the first catalog model", () => {
    expect(
      resolveChatModel(models, {
        runModelId: "missing/model",
        storedModelId: "also/missing",
      })?.id,
    ).toBe("openai/gpt-5.1")
  })

  it("returns null when the catalog is empty", () => {
    expect(
      resolveChatModel([], { storedModelId: "anthropic/claude" }),
    ).toBeNull()
  })
})

describe("selected model storage", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("returns null when nothing is saved", () => {
    expect(readSelectedModelId()).toBeNull()
  })

  it("round-trips the selected model id", () => {
    writeSelectedModelId("anthropic/claude")
    expect(readSelectedModelId()).toBe("anthropic/claude")
  })
})
