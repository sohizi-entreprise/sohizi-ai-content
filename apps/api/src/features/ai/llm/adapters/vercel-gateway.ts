import { createGateway } from "ai"
import {
  gatewayCallExtras,
  gatewayCost,
  generateWithModel,
  streamWithModel,
} from "../call"
import type {
  LlmAdapter,
  LlmCallInput,
  LlmStream,
  LlmTextResult,
} from "../types"

const providers = new Map<string, ReturnType<typeof createGateway>>()

function providerFor(apiKey: string) {
  const cached = providers.get(apiKey)
  if (cached) return cached
  const provider = createGateway({ apiKey })
  providers.set(apiKey, provider)
  return provider
}

export class VercelGatewayAdapter implements LlmAdapter {
  readonly name = "vercel-gateway"

  constructor(private readonly apiKey: string) {}

  private model(apiName: string) {
    return providerFor(this.apiKey)(apiName)
  }

  generateText(input: LlmCallInput): Promise<LlmTextResult> {
    return generateWithModel(this.model(input.apiName), input, {
      ...gatewayCallExtras(input),
      costFrom: gatewayCost,
    })
  }

  streamText(input: LlmCallInput): LlmStream {
    return streamWithModel(this.model(input.apiName), input, {
      ...gatewayCallExtras(input),
      costFrom: gatewayCost,
    })
  }
}
