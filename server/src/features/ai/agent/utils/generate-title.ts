import { ModelMessage } from "ai";
import { TokenUsage } from "@/type";
import { LlmClient } from "./llm-client";
import { streamEvents } from "./llm-response";

const titleClient = new LlmClient("gpt-5-nano", {
    reasoningEffort: "minimal",
    maxOutputTokens: 32,
});

type GenerateTitleResult = {
    title: string;
    usage: TokenUsage;
}

export async function generateTitle(firstMsg: string, abortSignal: AbortSignal): Promise<GenerateTitleResult> {
    const titleMessages: ModelMessage[] = [
        {
            role: "system",
            content: getSystemPrompt(),
        },
        {
            role: "user",
            content: `Give me a title based on this message:\n${firstMsg}`,
        },
    ];

    for await (const chunk of titleClient.invoke({
        messages: titleMessages,
        abortSignal,
        stream: false,
    })) {
        if (chunk.type === streamEvents.complete) {
            if (chunk.error) {
                throw new Error(chunk.error);
            }

            return {
                title: chunk.text.trim(),
                usage: chunk.usage,
            };
        }
    }

    throw new Error("Title generation did not return a completion.");
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