import { ProjectBrief, NarrativeArc, synopsisSchema} from "zSchemas";
import { streamStructuredOutput } from "../stream-llm";
import { z } from "zod";
import { BaseGeneratorParams } from "../type";
import { ProseDocument } from "@/type";

type Payload = {
    narrativeArc: NarrativeArc;
    brief: ProjectBrief;
}

type synopsisGeneratorParams = BaseGeneratorParams<ProseDocument, Payload>

export const generateSynopsis = (params: synopsisGeneratorParams) => {
    const { payload: {narrativeArc, brief}, onSuccess, onError, onAbort, abortSignal, onUsageUpdate } = params;

    const systemPrompt = getSystemPrompt();
    const userPrompt = getUserPrompt(narrativeArc, brief);
    const schema = synopsisSchema;

    return streamStructuredOutput({
        systemPrompt,
        userPrompt,
        outputSchema: synopsisSchema,
        schema,
        abortSignal,
        eventName: 'TASK_UPDATE',
        transform: transformToProse,
        onSuccess,
        onUsageUpdate,
        onError,
        onAbort,
        model: "gpt-5.1",
        reasoningEffort: "low",
    })

}

function transformToProse(data: z.infer<typeof synopsisSchema>){
    const doc = {
        type: 'doc' as const,
        content: [
            {
                type: 'heading',
                content: [{ type: 'text', text: data.title }],
            },
        ],
    }

    const paragraphs = data.content.split('\n\n');
    for (const paragraph of paragraphs) {
        doc.content.push({
            type: 'paragraph',
            content: [{ type: 'text', text: paragraph }],
        })
    }
    return doc;
}

const getSystemPrompt = () => `
**CORE DIRECTIVE:** 
Your sole function is to write a highly compelling, concise synopsis from a provided narrative arc. You must distill the story down to its absolute core, revealing the complete narrative from the opening hook to the final resolution. 

## THE SYNOPSIS ANATOMY
Your synopsis must read as a seamless, punchy overview of the entire story. Structure it as follows:
1. **The Setup (Act I):** Introduce the flawed protagonist, their world, and the inciting incident immediately. Tell us whose story this is and what shatters their status quo.
2. **The Escalation (Act II):** What is the central driving conflict? Highlight the concrete actions the protagonist takes, the specific forces pushing back, and the major turning point or complication that raises the stakes.
3. **The Climax & Resolution (Act III):** Bring the conflict to a boiling point and **reveal the ending**. Detail the final showdown or impossible choice, and clearly state how the story resolves and where the protagonist ends up. *Do not use cliffhangers or tease the ending—you must spoil it.*

## THE EDIT (Ruthless Brevity)
- **Strict Anti-Verbosity Rule:** Never use two words when one will do. Cut overwritten descriptions, redundant phrasing, and excessive adjectives/adverbs. State the facts of the story as economically as possible.
- **Zero Fat:** Exclude world-building trivia, minor characters, subplots, and thematic explanations. 
- **Action over Lore:** Focus on what *happens*, what it *costs*, and how it *ends*. 
- **Causal Chain:** Ensure events connect directly (Because X happens, they must do Y, leading to Z).

## VOICE & TONE (The "Human" Requirement)
- **Sound Human:** Write like a sharp, articulate literary manager outlining a script. 
- **Be Punchy:** Use active voice, strong verbs, and lean sentences. It must sound urgent and undeniable.
- **Show, Don't Sell:** Do not use marketing hype (e.g., "In a thrilling twist," "Will they survive?", or "Get ready for a wild ride"). Let the story's events speak for themselves.

## BANNED AI JARGON
You must absolutely avoid flowery, cliché AI phrasing. Do NOT use words or phrases like: 
*delve, tapestry, navigate, symphony, interwoven, testament, visceral, embark, perilous, intricate, "a world where", or "a tale of".* Zero melodramatic poetry.

## OUTPUT RULES
- Output **ONLY** the text of the synopsis. 
- Do not include headers (like "The Setup" or "Synopsis:").
- Do not include conversational filler, greetings, or explanations of your work.
`

const getUserPrompt = (narrativeArc: NarrativeArc, brief: ProjectBrief) => `
Generate a synopsis for the following ${brief.format} project.
---
Here is the initial project brief:
\`\`\`json
${JSON.stringify(brief)}
\`\`\`

---
Here is the selected narrative arc:
\`\`\`json
${JSON.stringify(narrativeArc)}
\`\`\`
`

