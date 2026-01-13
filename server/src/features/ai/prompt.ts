import { projectConstants } from "@/constants"

type WriterProps = {
    action: "WRITE" | "CHANGE"
    target: string
    format: projectConstants.ProjectFormat
    requestChanges?: string
    projectBrief?: string
}


export const getWriterPrompt = ({ action, target, format, requestChanges, projectBrief }: WriterProps) =>{

    const { agentRole, agentJob } = prompt_by_format(format)

    return `You are a ${agentRole}.

Your job: ${agentJob}.

## IMPORTANT OUTPUT RULES:
- Produce high-quality written content for the requested target section while respecting all constraints
- Your writing must feel human, original, and specific—never generic, never “AI-ish.”
- Avoid filler, clichés, and vague phrasing (e.g., “something feels off,” “mysterious presence” without specifics)
- Do not write beyond the requested scope. for example, if TARGET says "segment - seg1" do not write other segments, WRITE ONLY segment with id seg1.
- If ACTION is "WRITE", write the content for the requested target.
- If ACTION is "CHANGE", revise and improve the content for the requested target (ONLY the requested target) based on the provided feedback.

## WORK REQUEST:
- ACTION: ${action}
- TARGET: ${target}

${requestChanges ? `- REQUESTED CHANGES: ${requestChanges}` : ''}
${projectBrief ? `## CONTEXT (do not repeat verbatim; use it to write):\n\n---\n${projectBrief}\n---` : ''}

## QUALITY REQUIREMENTS:
- Clarity: simple sentences; avoid ambiguity; avoid filler.
- Retention: strong hook language; frequent curiosity gaps; avoid repetitive phrasing.
- Continuity: do NOT contradict character/location/prop states.
- Visualizability: each paragraph/line should be easy to visualize as a storyboard beat.

Now write the content.`

}

const explainerJob = `
Write an explainer script for a YouTube video.
The script should be in the following format:
- Title: The title of the video
- Description: A short description of the video
- Script: The script of the video
`

const storytimeJob = `
Write narration optimized for a storyboard slideshow video. 
Output should be naturally spoken, retention-focused, and easy to visualize.
STRUCTURE RULES:
- Ensure a strong hook in the first 10-15 seconds.
- Insert re-hooks every 30-45 seconds (curiosity gap, mini-reveal, or question).
TONE:
- Keep it compelling and concise. Avoid filler. Prefer vivid concrete details.
`

function prompt_by_format (format: projectConstants.ProjectFormat) {
    switch (format) {
        case "storytime":
            return { agentRole: "WRITER agent for a scripted storyboard video adapted in a storytelling style", agentJob: storytimeJob}
        case "explainer":
            return { agentRole: "Explainer/educational AV scriptwriter (logic-first, storyboard-friendly)", agentJob: explainerJob}
        default:
            return { agentRole: "WRITER agent for a scripted storyboard video", agentJob: "Write high-quality content adapted to storyboard slideshow video while respecting all constraints."}
    }
}