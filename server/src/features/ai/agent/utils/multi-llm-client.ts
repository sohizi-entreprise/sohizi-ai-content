
import { OpenRouter } from '@openrouter/sdk';
import { ChatContentImage, ChatContentVideo, ChatMessages } from '@openrouter/sdk/esm/models';

// Analyze image, video, audio
// Websearch access
// stream text and normal response

type MediaType = 'image' | 'video';

type AnalyzeMediaRequest = {
    type: MediaType;
    url: string;
    prompt: string;
}

type CompletionRequest = {
    messages: ChatMessages[];
}

type ModelConfig = {
    modelId: string;
    maxTokens?: number;
}

class MultiLlmClient {
    private client: OpenRouter | null = null;
    private modelConfig: ModelConfig;

    constructor(modelConfig: ModelConfig) {
        this.modelConfig = modelConfig;
    }

    async fullResponse(){

    }

    async stream(request: CompletionRequest){
        const client = this.getClient();
        const response = await client.chat.send({
            chatRequest: {
                model: this.modelConfig.modelId,
                messages: request.messages,
                maxTokens: this.modelConfig.maxTokens,
                stream: true,
            }
        })
        for await (const chunk of response){
            const msg = chunk.choices[0]
            

        }
        
        return
    }

    async analyzeImage(request: AnalyzeMediaRequest){
        const client = this.getClient();
        let mediaPayload: ChatContentImage | ChatContentVideo;
        switch(request.type){
            case 'image':
                mediaPayload = {
                    type: 'image_url',
                    imageUrl: {url: request.url},
                }
                break;
            case 'video':
                mediaPayload = {
                    type: 'video_url',
                    videoUrl: {url: request.url},
                }
                break;
        }
        
        const result = await client.chat.send({
            chatRequest: {
                model: this.modelConfig.modelId,
                messages: [
                    {
                        role: "user",
                        content: [
                            {type: "text", text: request.prompt},
                            mediaPayload,
                        ]
                    }
                ],
                maxTokens: this.modelConfig.maxTokens,
                modalities: ["text"]
            }
        })

        const usage = result.usage;

        const modelUsage = {
            input: usage?.completionTokens || 0,
            output: usage?.promptTokens || 0,
            total: usage?.totalTokens || 0,
            cost: usage?.cost || 0,
            modelId: this.modelConfig.modelId,
        }

        const content = result.choices[0].message.content;
    }

    private getClient(){
        if(this.client){
            return this.client;
        }
        this.client = new OpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
        });
        return this.client;
    }
}