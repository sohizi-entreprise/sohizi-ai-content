export type ChatRequest = {
    projectId: string;
    modelId: string;
    userPrompt: string;
}

export async function handleChat({modelId, userPrompt, projectId}: ChatRequest) {
    // Get the model config
    // Create the session
    return {msg: 'deprecated'}

}

