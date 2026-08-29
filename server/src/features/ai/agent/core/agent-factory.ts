import type { ResolvedVendorModel } from '@/features/models/repo'
import { getModelWithVendorBinding } from '@/features/models/repo'
import { Agent } from './agent'
import { getAgentDefinition, type AgentDefinition, type AgentName } from './agent-registry'
import type { Persistence } from './persistence'
import type { Session } from './session'

export type CreateAgentFromDefinitionOptions = {
    agentName: AgentName
    session: Session
    model?: ResolvedVendorModel
    systemPrompt?: string
    buildSystemPrompt?: (baseSystemPrompt: string, definition: AgentDefinition) => string
    persistence?: Persistence
}

export async function createAgentFromDefinition(
    options: CreateAgentFromDefinitionOptions,
): Promise<Agent> {
    const { agentName, session, persistence } = options

    const definition = getAgentDefinition(agentName)
    if (!definition) {
        throw new Error(`Agent definition not found: ${agentName}`)
    }

    const model = options.model ?? await getModelWithVendorBinding(definition.modelId, definition.vendor)
    if (!model) {
        throw new Error(`Model not found for agent ${agentName}: ${definition.modelId}`)
    }

    const systemPrompt = options.buildSystemPrompt
        ? options.buildSystemPrompt(definition.baseSystemPrompt, definition)
        : (options.systemPrompt ?? definition.baseSystemPrompt)

    return new Agent({
        name: definition.name,
        systemPrompt,
        session,
        model,
        vendor: definition.vendor,
        modelConfig: definition.modelConfig,
        persistence,
        maxContextTokens: definition.maxContextTokens,
        contextThreshold: definition.contextThreshold,
        summaryModelId: definition.summaryModelId,
        evaluatorModelId: definition.evaluatorModelId,
        evaluatorModelConfig: definition.evaluatorModelConfig,
    })
}
