import { describe, expect, it } from "bun:test"
import { gatewayCallExtras, omitEmptySystemMessages } from "./call"
import type { LlmCallInput } from "./types"
import type { ModelMessage } from "ai"

function input(
  overrides: Partial<
    Pick<LlmCallInput, "reasoningEffort" | "reasoningSummary" | "gatewayModels">
  >,
): LlmCallInput {
  return {
    apiName: "anthropic/claude-sonnet-4.6",
    messages: [],
    abortSignal: new AbortController().signal,
    ...overrides,
  }
}

describe("gatewayCallExtras", () => {
  it("sends portable reasoning and no provider effort", () => {
    expect(gatewayCallExtras(input({ reasoningEffort: "medium" }))).toEqual({
      reasoning: "medium",
      providerOptions: undefined,
    })
  })

  it("keeps OpenAI max while other providers get the highest portable level", () => {
    expect(gatewayCallExtras(input({ reasoningEffort: "max" }))).toEqual({
      reasoning: "xhigh",
      providerOptions: { openai: { reasoningEffort: "max" } },
    })
  })

  it("keeps reasoning summaries on OpenAI without overriding effort", () => {
    expect(
      gatewayCallExtras(
        input({ reasoningEffort: "low", reasoningSummary: "auto" }),
      ),
    ).toEqual({
      reasoning: "low",
      providerOptions: { openai: { reasoningSummary: "auto" } },
    })
  })

  it("sends gateway model fallbacks with OpenAI options", () => {
    expect(
      gatewayCallExtras(
        input({
          reasoningEffort: "low",
          gatewayModels: ["typesafe-ai/jev", "perplexity/pplx-decider-v1.2"],
        }),
      ),
    ).toEqual({
      reasoning: "low",
      providerOptions: {
        gateway: {
          models: ["typesafe-ai/jev", "perplexity/pplx-decider-v1.2"],
        },
      },
    })
  })

  it("omits reasoning when effort is unset", () => {
    expect(gatewayCallExtras(input({ reasoningSummary: "none" }))).toEqual({
      reasoning: undefined,
      providerOptions: { openai: { reasoningSummary: "none" } },
    })
  })
})

describe("omitEmptySystemMessages", () => {
  it("drops blank system messages that Anthropic rejects", () => {
    const messages: ModelMessage[] = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "system", content: "   " },
      { role: "user", content: "Say hi." },
    ]

    expect(omitEmptySystemMessages(messages)).toEqual([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say hi." },
    ])
  })
})
