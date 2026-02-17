import { FinishReason, streamText, Output, FlexibleSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

type SupportedModels = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-5.1' | 'gpt-5-mini' | 'gpt-5-nano';

type ModelSettings = {
    temperature?: number
    maxRetries?: number
    maxOutputTokens?: number
    timeout?: number
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' 
}

type BaseStreamParams = {
    model: SupportedModels
    systemPrompt: string
    userPrompt: string
    modelSettings?: ModelSettings
    onError?: (error: string) => void
    abortSignal?: AbortSignal
}

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export type TextStreamParams = {
    onFinish?: (result: { text: string, finishReason: FinishReason, totalTokens: number }) => void
} & BaseStreamParams

export type JsonStreamParams<TSchema> = {
    schema: FlexibleSchema<TSchema>
    outputType?: 'object' | 'array'
    onFinish?: (result: { json: TSchema, finishReason: FinishReason, totalTokens: number }) => void
} & BaseStreamParams

export const streamLlmText = async (params: TextStreamParams) => {
    const {model, systemPrompt, userPrompt, onFinish, onError, modelSettings={}, abortSignal} = params
    const {temperature=0.5, maxRetries=1, reasoningEffort='minimal', maxOutputTokens, timeout} = modelSettings
    const result = streamText({
        model: openai(model),
        system: systemPrompt,
        prompt: userPrompt,
        temperature,
        maxRetries,
        maxOutputTokens,
        timeout,
        abortSignal,
        providerOptions: {
            openai:{
                reasoningEffort
            }
        },
        onError({error}){
            if (error instanceof Error) {
                onError?.(error.message)
            } else {
                onError?.(`Error occurred: ${error}`)
            }
        },
        onFinish({text, finishReason, totalUsage}){
            if(finishReason === "error"){
                return
            }
            onFinish?.({text, finishReason, totalTokens: totalUsage.totalTokens || 0})
        },
      });
    return result.textStream
}

export async function streamLlmJson<TSchema>(params: JsonStreamParams<TSchema>){
    const {model, systemPrompt, userPrompt, schema, outputType='object', onFinish, onError, modelSettings={}, abortSignal} = params
    const {temperature=0.5, maxRetries=1, reasoningEffort='minimal', maxOutputTokens, timeout} = modelSettings

    const { partialOutputStream } = streamText({
        model: openai(model),
        output: outputType === 'array' ? Output.array({ element: schema }) : Output.object({ schema }),
        prompt: userPrompt,
        system: systemPrompt,
        temperature,
        maxRetries,
        maxOutputTokens,
        timeout,
        abortSignal,
        providerOptions: {
            openai:{
                reasoningEffort
            }
        },
        onError({error}){
            if (error instanceof Error) {
                onError?.(error.message)
            } else {
                onError?.(`Error occurred: ${error}`)
            }
        },
        onFinish({text, finishReason, totalUsage}){
            if(finishReason === "error"){
                return
            }
            try {
                const json = JSON.parse(text)
                onFinish?.({json, finishReason, totalTokens: totalUsage.totalTokens || 0})
            } catch (e) {
                if (e instanceof Error) {
                    onError?.(`Error parsing JSON: ${e.message}`)
                } else {
                    onError?.(`Error parsing JSON: ${e}`)
                }
            }
        },
      });

    return partialOutputStream
}

// const ch = z.object({
//     capital: z.string(),
// })

// const jk = {
//     model: 'gpt-5.1' as const,
//     systemPrompt: 'You are a helpful assistant.',
//     userPrompt: 'What is the capital of France?',
//     schema: ch,
//     outputType: 'object' as const,
//     onFinish: (result: { json: z.infer<typeof ch>, finishReason: FinishReason, totalTokens: number }) => {
//         console.log(result)
//     },
//     onError: (error: string) => {
//         console.error(error)
//     }
// }