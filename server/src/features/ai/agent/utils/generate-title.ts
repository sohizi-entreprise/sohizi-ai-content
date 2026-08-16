import { ModelMessage } from "ai";
import { createBillableLlmClient } from "./llm-client";
import { getModelWithVendorBinding } from "@/features/models/repo";
import { DEFAULT_AGENT_VENDOR } from "../core/vendor";
import { billingService, withBilling } from "@/features/billing";
import { estimateInputTokens } from "./estimate-token";
import { v4 as uuidv4 } from 'uuid';

type GenerateTitleResult = {
    title: string;
}

type GenerateTitleRequest = {
    message: string;
    modelId: string;
    organizationId: string;
    abortSignal: AbortSignal;
}

export async function generateTitle(request: GenerateTitleRequest): Promise<GenerateTitleResult> {
    const { message, modelId, organizationId, abortSignal } = request;
    let title = derivedTitle(message);
    try {
        const model = await getModelWithVendorBinding(modelId, DEFAULT_AGENT_VENDOR);
        if (!model) {
            throw new Error('Model not found');
        }
        const client = createBillableLlmClient({
            model,
            modelConfig: {
                reasoningEffort: "minimal",
                maxOutputTokens: 32,
            }
        })
        const billedClient = withBilling(client, billingService);
    
        const titleMessages: ModelMessage[] = [
            {
                role: "system",
                content: getSystemPrompt(),
            },
            {
                role: "user",
                content: `Give me a title based on this message:\n${message}`,
            },
        ];
    
        const output = await billedClient({
            messages: titleMessages,
            estimatedInputTokens: estimateInputTokens(titleMessages, 1.15),
            estimatedOutputTokens: 60,
            stream: false,
        }, {
            organizationId,
            signal: abortSignal,
            metadata: {
                runId: uuidv4(),
            }
        });
    
        title = output.text.trim();
    
        if (output.error) {
            console.error("Title generation failed: ", output.error);
        }

    } catch (error) {
        console.error("Title generation failed: ", error);
    }
    
    return { title };
}

function getSystemPrompt() {
    return `
You are a specialized title-generation assistant. Your only task is to generate a concise, 3-5 word title for a conversation based on the user's first message.

### Guidelines:
- The title must clearly represent the main theme, intent, or subject of the message.
- Write the title in the message's primary language.
- Format the output in Title Case (e.g., Capitalize The Main Words).
- Prioritize accuracy over excessive creativity; keep it clear and simple.
- Handle Edge Cases: If the message is just a greeting (e.g., "hi", "hello") or unclear, use a generic title like "New Conversation" or "General Greeting".

### Strict Formatting Rules:
- CRITICAL: Return ONLY the raw title text. 
- DO NOT wrap the title in quotes.
- DO NOT use markdown, prefixes (like "Title:"), or punctuation (no periods, commas, or question marks).
- DO NOT include any conversational text, greetings, or explanations.

### Examples of perfect outputs:
Stock Market Trends
Perfect Chocolate Chip Recipe
Evolution of Music Streaming
Remote Work Productivity Tips
AI in Healthcare
Video Game Development Insights
`.trim();
}

function derivedTitle(firstMsg: string) {
    const title = firstMsg
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15)
        .toLowerCase();

    return title.charAt(0).toUpperCase() + title.slice(1);
}