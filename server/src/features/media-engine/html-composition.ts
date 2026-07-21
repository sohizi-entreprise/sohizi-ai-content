import type { CompositionVariable } from '@/type'
import type { SubmitHtmlCompositionDoneInput } from '@/features/ai/agent/tools/submit-html-composition'

export type HtmlCompositionSubmission = {
    html: string
    name: string
    duration: number
    width: number
    height: number
    variables: CompositionVariable[]
    values: Record<string, string | number | boolean>
    compositionId?: string
}

export type HtmlCompositionHandoff =
    | { status: 'done'; submission: HtmlCompositionSubmission }
    | { status: 'blocked'; message: string }

/** In-process handoff from submitHtmlComposition → Inngest step (same process). */
const handoffsByRunId = new Map<string, HtmlCompositionHandoff>()

/**
 * Pull the JSON array from `data-composition-variables` by bracket-matching.
 * Quote-based regexes break on apostrophes inside defaults (e.g. Newton's).
 */
export function extractVariableSchema(html: string): CompositionVariable[] {
    const marker = html.search(/data-composition-variables\s*=/)
    if (marker === -1) return []

    const eq = html.indexOf('=', marker)
    if (eq === -1) return []

    const after = html.slice(eq + 1).trimStart()
    const jsonStart = after.search(/[[{]/)
    if (jsonStart === -1) return []

    const open = after[jsonStart]
    const close = open === '[' ? ']' : '}'
    let depth = 0
    let inString = false
    let escape = false

    for (let i = jsonStart; i < after.length; i++) {
        const ch = after[i]
        if (escape) {
            escape = false
            continue
        }
        if (ch === '\\' && inString) {
            escape = true
            continue
        }
        if (ch === '"') {
            inString = !inString
            continue
        }
        if (inString) continue
        if (ch === open) depth++
        else if (ch === close) {
            depth--
            if (depth === 0) {
                try {
                    const parsed = JSON.parse(after.slice(jsonStart, i + 1))
                    return Array.isArray(parsed) ? (parsed as CompositionVariable[]) : []
                } catch {
                    return []
                }
            }
        }
    }

    return []
}

export function buildDefaultValues(
    variables: CompositionVariable[],
): Record<string, string | number | boolean> {
    return Object.fromEntries(variables.map((v) => [v.id, v.default]))
}

export function extractCompositionId(html: string): string | undefined {
    const match =
        html.match(/data-composition-id=["']([^"']+)["']/) ??
        html.match(/id=["']([^"']+)["'][^>]*data-composition-id/)
    return match?.[1]
}

export function buildHtmlCompositionSubmission(
    input: SubmitHtmlCompositionDoneInput,
): HtmlCompositionSubmission {
    const variables = extractVariableSchema(input.html)
    return {
        html: input.html,
        name: input.name?.trim() || `html-video-${Date.now().toString(36)}`,
        duration: input.duration,
        width: input.width ?? 1920,
        height: input.height ?? 1080,
        variables,
        values: buildDefaultValues(variables),
        compositionId: extractCompositionId(input.html),
    }
}

export function setHtmlCompositionSubmission(
    runId: string,
    submission: HtmlCompositionSubmission,
): void {
    handoffsByRunId.set(runId, { status: 'done', submission })
}

export function setHtmlCompositionBlocked(runId: string, message: string): void {
    handoffsByRunId.set(runId, { status: 'blocked', message })
}

/** Read and clear the handoff for a run. */
export function takeHtmlCompositionHandoff(
    runId: string,
): HtmlCompositionHandoff | null {
    const handoff = handoffsByRunId.get(runId) ?? null
    if (handoff) {
        handoffsByRunId.delete(runId)
    }
    return handoff
}
