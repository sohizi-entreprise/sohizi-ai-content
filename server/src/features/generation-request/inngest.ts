import { NonRetriableError } from 'inngest';
import { inngest } from '@/lib/inngest';
import { ChatCompletionRequest, MediaGenerationRequest } from './schema';
import { updateGenerationRequest } from './repo';
import { generateTitle } from '../ai/agent/utils/generate-title';
import { Checkpoint, Conversation, LlmModel } from '@/db/schema';
import { getConversationById } from '@/entities/chat/repo';
import { Agent } from '../ai/agent/core/agent';
import { Session } from '../ai/agent/core/session';
import { CheckpointPersistence, MediaGenerationPersistence } from '../ai/agent/core/persistence';
import { createConversationWithCheckpoint, getCheckpoint, getModelById } from '../chat/repo';
import { generateSystemPrompt } from '../ai/agent/core/sys-prompt';
import { listTools } from '../ai/agent/tools/tool-registry';
import { UserModelMessage } from 'ai';
import { startRequest, writeRequestEvent, completeRequest } from './stream-handler';
import { createCancellableController } from './abort-manager';
import { getAgentDefinition } from '../ai/agent/core/agent-registry';
import type { MediaJob } from '../ai/agent/tools/submit-media-jobs';
import { handleImageGeneration, handleVideoGeneration } from '../media-engine/inngest';

export type BaseContextEventData = {
    requestId: string;
    projectId: string;
    organizationId: string;
    userId: string;
}
type ChatCompletionEventData = {
    request: ChatCompletionRequest;
    context: BaseContextEventData
}

type MediaGenerationEventData = {
    request: MediaGenerationRequest;
    context: BaseContextEventData
}

export const handleChatCompletionFunc = inngest.createFunction(
    {
        id: 'chat-completion',
        retries: 0,
        triggers: [{ event: 'stream/chat.completion' }],
        onFailure: async ({ event, error, step }) => {
            const data = event.data.event.data as ChatCompletionEventData;
            const { requestId, userId } = data.context;
            if (requestId) {
                await step.run('mark-generation-failed', async () => {
                    await updateGenerationRequest(requestId, {
                        status: 'failed',
                        error: getErrorMessage(error),
                    });
                    await writeRequestEvent({
                        requestId,
                        event: { event: 'error', requestId, data: { error: getErrorMessage(error) } },
                    });
                    await completeRequest(userId, requestId);
                });
            }
        },
    },
    async ({ event, step }) => {

        const data = event.data as ChatCompletionEventData;

        const { request, context } = data;
        const { requestId, projectId, organizationId, userId } = context;

        await step.run('register-request', () =>
            startRequest(userId, requestId, 'chat-completion'),
        );

        const model = await step.run('resolve-model', async () => {
            const resolved = await getModelById(request.modelId);
            if (!resolved) {
                throw new NonRetriableError(`Model not found: ${request.modelId}`);
            }
            return resolved;
        });

        await step.run('mark-processing', () =>
            updateGenerationRequest(requestId, { status: 'processing' }),
        );

        const resultManageConversation = await step.run('manage-conversation', async () => {
            const { controller, cleanup } = await createCancellableController(requestId);

            try {
                let conversation: Conversation | null = null;
                let checkpoint: Checkpoint | null = null;

                if(request.conversationId){
                    conversation = await getConversationById(request.conversationId);
                    checkpoint = await getCheckpoint(projectId, request.conversationId);
                }else{
                    const textPrompt = request.prompt.content.find(p => p.type === 'text')?.text ?? '';
                    const {title} = await generateTitle({
                        message: textPrompt,
                        modelId: 'gpt-5-nano',
                        organizationId,
                        abortSignal: controller.signal,
                    })
                    const {conversation: newConversation, checkpoint: newCheckpoint} = await createConversationWithCheckpoint(projectId, userId, title);
                    conversation = newConversation;
                    checkpoint = newCheckpoint;
                }
                if(!conversation || !checkpoint){
                    throw new NonRetriableError('Failed to create conversation or checkpoint');
                }
                await writeRequestEvent({
                    requestId,
                    event: { event: 'chat-completion', requestId, data: { type: "identifier", conversationId: conversation.id, conversationTitle: conversation.title } },
                });
                return {conversation, checkpoint};
            } finally {
                await cleanup();
            }
        });

        await step.run('run-agent', async () => {
            const { controller, cleanup } = await createCancellableController(requestId);

            try {
                const {conversation, checkpoint} = resultManageConversation;
                const session = new Session({
                    sessionId: requestId,
                    userId,
                    organizationId,
                    projectId,
                    conversationId: conversation.id,
                })
                const checkpointPersistence = new CheckpointPersistence(checkpoint as unknown as Checkpoint);
                const agent = new Agent({
                    name: 'main-agent',
                    systemPrompt: generateSystemPrompt(),
                    session,
                    model: model as unknown as LlmModel,
                    modelConfig: {
                        reasoningEffort: 'medium',
                        reasoningSummary: 'auto',
                        maxOutputTokens: 3000,
                        tools: listTools(),
                    },
                    persistence: checkpointPersistence,
                })

                const userPrompt = await formatUserPrompt(request.prompt);

                const chunks = agent.runLoop(
                    userPrompt,
                    controller.signal,
                    250,
                )

                for await (const chunk of chunks) {
                    await writeRequestEvent({
                        requestId,
                        event: { event: 'chat-completion', requestId, data: {...chunk, conversationId: conversation.id} },
                    });
                }

                await writeRequestEvent({
                    requestId,
                    event: { event: 'chat-completion', requestId, data: { type: "complete", conversationId: conversation.id } },
                });

                await completeRequest(userId, requestId);
            } finally {
                await cleanup();
            }
        })
    },
);


export const handleMediaGenerationFunc = inngest.createFunction(
    {
        id: 'media-generation',
        retries: 0,
        triggers: [{ event: 'stream/media.generation' }],
        onFailure: async ({ event, error, step }) => {
            const data = event.data.event.data as MediaGenerationEventData;
            const { requestId, userId } = data.context;
            if (requestId) {
                await step.run('mark-generation-failed', async () => {
                    await updateGenerationRequest(requestId, {
                        status: 'failed',
                        error: getErrorMessage(error),
                    });
                    await writeRequestEvent({
                        requestId,
                        event: { event: 'error', requestId, data: { error: getErrorMessage(error) } },
                    });
                    await completeRequest(userId, requestId);
                });
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as MediaGenerationEventData;
        const { request, context } = data;
        const { requestId, userId, organizationId, projectId } = context;
    
        await step.run('register-request', () =>
            startRequest(userId, requestId, 'media-generation'),
        );

        await step.run('mark-processing', () =>
            updateGenerationRequest(requestId, { status: 'processing' }),
        );

        const resolvedModel = await step.run('resolve-model', async () => {
            const agentDefinition = getAgentDefinition('media-generator');
            if(!agentDefinition){
                throw new NonRetriableError('Agent definition not found');
            }
            const resolved = await getModelById(agentDefinition.modelId);
            if (!resolved) {
                throw new NonRetriableError(`Model not found: ${agentDefinition.modelId}`);
            }
            return { model: resolved };
        });

        const agentResult = await step.run('run-agent', async () => {
            const { model } = resolvedModel;
            const agentDefinition = getAgentDefinition('media-generator');
            if(!agentDefinition){
                throw new NonRetriableError('Agent definition not found');
            }
            const session = new Session({
                sessionId: requestId,
                userId,
                organizationId,
                projectId,
            });

            const agent = new Agent({
                name: agentDefinition.name,
                systemPrompt: agentDefinition.baseSystemPrompt,
                session,
                model: model as unknown as LlmModel,
                modelConfig: agentDefinition.modelConfig,
                persistence: new MediaGenerationPersistence(requestId),
            });

            const userPrompt = await formatUserPrompt(request.prompt);

            for await (const chunk of agent.runLoop(userPrompt, new AbortController().signal)) {
                await writeRequestEvent({
                    requestId,
                    event: { event: 'media-generation', requestId, data: chunk },
                });
            }

            return extractSubmittedJobs(agent.stateManager.getState().messages);
        });

        if (agentResult.status === 'blocked') {
            await step.run('mark-blocked', async () => {
                await updateGenerationRequest(requestId, { status: 'failed', error: agentResult.message });
                await completeRequest(userId, requestId);
            });
            return;
        }

        if (agentResult.jobs.length > 0) {
            await Promise.all(
                agentResult.jobs.map((job, i) => {
                    switch (job.type) {
                        case 'image':
                            return step.invoke(`invoke-image-${i}`, {
                                function: handleImageGeneration,
                                data: {
                                    requestId,
                                    projectId,
                                    organizationId,
                                    userId,
                                    prompt: job.prompt,
                                    model: job.model,
                                    aspectRatio: job.aspectRatio,
                                    referenceImages: job.referenceImages,
                                    numVariations: job.numVariations,
                                },
                            });
                        case 'video':
                            return step.invoke(`invoke-video-${i}`, {
                                function: handleVideoGeneration,
                                data: {
                                    requestId,
                                    projectId,
                                    organizationId,
                                    userId,
                                    prompt: job.prompt,
                                    model: job.model,
                                    duration: job.duration,
                                    aspectRatio: job.aspectRatio,
                                    referenceImage: job.referenceImage,
                                },
                            });
                    }
                })
            );
        }

        await step.run('mark-completed', async () => {
            await updateGenerationRequest(requestId, { status: 'completed' });
            await completeRequest(userId, requestId);
        });
    }
)


async function formatUserPrompt(data: ChatCompletionRequest['prompt']): Promise<UserModelMessage>{

    const content: UserModelMessage['content'] = data.content.map(c => {
        if(c.type === 'text'){
            return {type: 'text', text: c.text};
        }
        if(c.type === 'image'){
            return {type: 'image', image: new URL(c.url)}
        }
        else {
            return {type: 'file', data: c.url, mediaType: c.mediaType}
        }
    })

    return {
        role: 'user',
        content
    }
    
}

type SubmitJobsResult =
    | { status: 'done'; jobs: MediaJob[]; message: string }
    | { status: 'blocked'; jobs: []; message: string };

function extractSubmittedJobs(messages: import('ai').ModelMessage[]): SubmitJobsResult {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== 'tool' || !Array.isArray(msg.content)) continue;

        for (const part of msg.content) {
            if (part.type !== 'tool-result' || part.toolName !== 'submitMediaJobs') continue;
            const raw = typeof part.output === 'string'
                ? part.output
                : (part.output as { type: string; value: string })?.value;
            if (!raw) continue;

            try {
                const parsed = JSON.parse(raw);
                if (parsed.status === 'done') {
                    return { status: 'done', jobs: parsed.jobs ?? [], message: parsed.message ?? '' };
                }
                return { status: 'blocked', jobs: [], message: parsed.message ?? 'Agent could not proceed' };
            } catch {
                continue;
            }
        }
    }

    return { status: 'blocked', jobs: [], message: 'Agent ended without submitting jobs' };
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}
