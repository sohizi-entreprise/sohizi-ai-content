import { StoryBible, storyBibleSchema } from "zSchemas";
import { streamStructuredOutput } from "../stream-llm";
import { BaseGeneratorParams } from "../type";
import { proseDocumentToPlainText } from "../utils";
import { ProseDocument } from "@/type";

type storyBibleGeneratorParams = BaseGeneratorParams<StoryBible, ProseDocument>

export const generateStoryBible = (params: storyBibleGeneratorParams) => {
    const { payload: synopsis, onSuccess, onError, onAbort, abortSignal, onUsageUpdate } = params;

    const systemPrompt = getSystemPrompt();
    const userPrompt = getUserPrompt(synopsis);
    const schema = storyBibleSchema;

    return streamStructuredOutput({
        systemPrompt,
        userPrompt,
        outputSchema: storyBibleSchema,
        schema,
        abortSignal,
        eventName: 'TASK_UPDATE',
        onSuccess,
        onUsageUpdate,
        onError,
        onAbort,
        model: "gpt-5.1",
        reasoningEffort: "low",
    })
}

const getSystemPrompt = () => `
You are a story development assistant creating a practical, writer-facing story bible.

Goal:
- Produce one high-quality story bible that is faithful to the provided material.
- Make it specific, coherent, and dramatically useful.
- Keep every field concise and straight to the point.

Core rules:
- Base the output only on the provided brief and synopsis.
- Preserve the genre, tone, emotional arc, and central conflict.
- Infer missing details only when necessary, and choose the most plausible option.
- Focus on story-driving information, not lore, filler, or poetic language.
- Do not write scenes, dialogue, beat sheets, or a full outline.
- Do not contradict the input.

Conciseness rules:
- Write compact, information-dense content.
- Prefer 1-3 sentences per string field.
- Avoid repetition across fields.
- Avoid vague phrases like "things get complicated" or "they learn an important lesson".
- Name concrete pressures, dynamics, stakes, rules, and behaviors.

Output rules:
- Return exactly one JSON object matching the schema.
- Be concise per key.
- No commentary, markdown, or extra text.
`

const getUserPrompt = (synopsis: ProseDocument) => `
Generate the story bible for this project.

Use the synopsis as the source of truth.
Keep the content concise, concrete, and useful for the next writing step.
Do not be verbose. Each field should contain only the most important information.
Return one JSON object only.

<synopsis>
${proseDocumentToPlainText(synopsis)}
</synopsis>
`