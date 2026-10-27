import { experimental_decide } from "ai"

type DecisionParams = {
  input: string
  choices: Record<string, string>
  instructions: string
  confidenceThreshold: number
  abortSignal?: AbortSignal
}

export const runDecision = async ({
  input,
  choices,
  instructions,
  confidenceThreshold,
  abortSignal,
}: DecisionParams) => {
  try {
    const result = await experimental_decide({
      model: "openai/gpt-6-luna-decisions",
      state: input,
      questions: {
        memories: {
          type: "choice",
          instructions,
          criteria: choices,
        },
      },
      providerOptions: {
        gateway: {
          models: ["typesafe-ai/jev", "perplexity/pplx-decider-v1.2"],
        },
      },
      abortSignal,
    })

    const usage = result.usage
    const cost = gatewayDecisionCost(result.providerMetadata?.gateway?.cost)
    const choice = result.answers.memories.choice
    const confidence = result.answers.memories.probabilities?.[choice]

    if (confidence == null || confidence < confidenceThreshold) {
      return { usage, cost, choice: null }
    }

    return { usage, cost, choice }
  } catch (error) {
    console.error(error)
    return { usage: null, cost: null, choice: null }
  }
}

function gatewayDecisionCost(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string" || value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
