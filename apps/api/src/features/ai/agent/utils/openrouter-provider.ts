import { createOpenRouter } from "@openrouter/ai-sdk-provider"

type OpenRouterProvider = ReturnType<typeof createOpenRouter>

let provider: OpenRouterProvider | undefined

export function getOpenRouterProvider(): OpenRouterProvider {
  if (!provider) {
    provider = createOpenRouter()
  }
  return provider
}
