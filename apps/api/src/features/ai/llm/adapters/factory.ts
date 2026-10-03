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

export function llmApiKeyEnvName(vendorName: string): string {
  return `${vendorName.toUpperCase().replace(/-/g, "_")}_API_KEY`
}

export function hasLlmApiKey(vendorName: string): boolean {
  return Boolean(process.env[llmApiKeyEnvName(vendorName)])
}

export function isRegisteredLlmAdapter(name: string): boolean {
  return name in ADAPTERS
}

export function createLlmAdapter(
  adapter: string,
  vendorName: string,
): LlmAdapter {
  const envName = llmApiKeyEnvName(vendorName)
  const apiKey = process.env[envName]
  if (!apiKey) {
    throw new LlmConfigurationError(`${envName} is not set`)
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
