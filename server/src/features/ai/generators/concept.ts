import { narrativeArcSchema, narrativeArcListSchema, NarrativeArcList, ProjectBrief } from "zSchemas";
import { streamStructuredOutput } from "../stream-llm";
import { z } from "zod";
import { BaseGeneratorParams } from "../type";

type conceptGeneratorParams = BaseGeneratorParams<NarrativeArcList, ProjectBrief>

export const generateConcept = (params: conceptGeneratorParams) => {
    const { payload:projectBrief, onSuccess, onError, onAbort, abortSignal, onUsageUpdate } = params;

    const systemPrompt = getSystemPrompt();
    const userPrompt = getUserPrompt(projectBrief);
    const schema = narrativeArcListSchema;

    return streamStructuredOutput({
        systemPrompt,
        userPrompt,
        outputSchema: z.array(narrativeArcSchema),
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
You are an elite story concept designer creating pitch-ready narrative arcs.

Generate exactly 3 clearly differentiated concepts from the brief:
1. Intuitive: the strongest audience-expected version of the premise.
2. Subversive: an unexpected but coherent reframing of the premise.
3. Emotional: centered on inner transformation and relationship stakes.

For every arc:
- Make the protagonist active.
- Make the conflict concrete and visual.
- Make the stakes specific and meaningful.
- Keep the concept aligned with the brief's format, audience, tone, and duration.
- Avoid vague abstractions, generic titles, and near-duplicate ideas.

Field guidance:
- title: specific, evocative, not generic.
- logline: exactly 1 sentence with protagonist, conflict, stakes, and emotional pull.
- synopsis: 2-3 compact paragraphs covering setup, escalation, complications, and climactic turning point, without revealing the ending.
- genre, tone, themes: concise and relevant arrays.
- source: always "agent".
- isSelected: always false.

Quality bar:
- The 3 arcs must feel meaningfully different in engine, tone, or story shape.
- Use concrete details, not broad poetic language.
- Keep the writing concise and straight to the point.
- Avoid filler, repetition, and unnecessary exposition.
- Keep each concept pitchable in one read.

Output rules:
- Return exactly 3 objects.
- Return only valid structured output matching the schema.
- No commentary, headings, or markdown.
`

const getUserPrompt = (brief: ProjectBrief) => `
Create 3 narrative arc concepts from the project brief below.

Use the brief as the source of truth for format, duration, audience, tone, and premise.
Do not repeat the same concept in slightly different wording.
Make each arc immediately understandable, distinctive, and compelling to a human reviewer.

Important:
- One arc should be intuitive, one subversive, and one emotional.
- Keep the concepts grounded in the brief.
- Favor specificity over generic drama.
- Keep the wording concise and straight to the point.
- Do not add any text outside the structured result.

---
${JSON.stringify(brief)}
`

