import { ModelMessage } from "ai";
import { encodeChat } from 'gpt-tokenizer';
import { extractTextFromContent } from "./message-content";


export function estimateInputTokens(messages: ModelMessage[], overEstimateFactor: number = 1.2): number {
    const sanitizedMessages = sanitizeMessages(messages);
    const encoded = encodeChat(sanitizedMessages, "gpt-5");
    return Math.ceil(encoded.length * overEstimateFactor);
}

function sanitizeMessages(messages: ModelMessage[]): {role: ModelMessage["role"], content: string}[] {
    return messages.map((message) => ({
        role: message.role,
        content: sanitizeContent(message.content),
    }));
}

function sanitizeContent(content: ModelMessage["content"]): string {
    return extractTextFromContent(content);
}