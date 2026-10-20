import { LlmConfigurationError } from "../errors"
import { OpenRouterAdapter } from "./openrouter"
import { VercelGatewayAdapter } from "./vercel-gateway"
import type { LlmAdapter } from "../types"

export const OPENROUTER_ADAPTER = "openrouter"
export const VERCEL_GATEWAY_ADAPTER = "vercel-gateway"

const ADAPTERS = {
  [OPENROUTER_ADAPTER]: OpenRouterAdapter,
  [VERCEL_GATEWAY_ADAPTER]: VercelGatewayAdapter,
} as const

export function isRegisteredLlmAdapter(name: string): boolean {
  return name in ADAPTERS
}

export function createLlmAdapter(
  adapter: string,
  _vendorName: string,
  apiKey: string,
): LlmAdapter {
  if (!apiKey) {
    throw new LlmConfigurationError("LLM API key is not set")
  }
  switch (adapter) {
    case OPENROUTER_ADAPTER:
      return new OpenRouterAdapter(apiKey)
    case VERCEL_GATEWAY_ADAPTER:
      return new VercelGatewayAdapter(apiKey)
    default:
      throw new LlmConfigurationError(`Unknown LLM adapter: ${adapter}`)
  }
}
