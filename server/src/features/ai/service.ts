import { E5SmallLocalEmbedder } from "@/lib/rag/local-embedder"
import { Agent } from "./agent/core/agent"
import { Session } from "./agent/core/session"
import { LlmClient, ModelConfig } from "./agent/utils/llm-client"
import { v4 as uuidv4 } from 'uuid'

export type ChatRequest = {
    projectId: string;
    modelId: string;
    userPrompt: string;
}

export async function handleChat({modelId, userPrompt, projectId}: ChatRequest) {
    // Get the model config
    // Create the session

    const embedder = new E5SmallLocalEmbedder()

    const session = new Session(
        uuidv4(),
        {
            modelId,
            reasoningEffort: 'medium',
        },
        projectId,
        embedder
    )

    const llmClient = new LlmClient(modelId, {reasoningEffort: 'medium', reasoningSummary: 'auto',})

    const agent = new Agent(
        'main-agent', 
        llmClient, 
        `You are a helpful assistant that can help with tasks.`,
        session
    )
    return agent.runLoop(userPrompt, new AbortController().signal, 25)

}

