import OpenAI from 'openai';
import { VideoSeconds, VideoSize } from 'openai/resources/videos';

export type ImageSizePreset =
  | 'auto'
  | 'square'
  | 'landscape'
  | 'portrait'
  | '2k-square'
  | '2k-landscape'
  | '4k-landscape'
  | '4k-portrait'

type BaseRequest = {
    model: string;
    prompt: string;
}

type TextToImageRequest = BaseRequest & {
    aspectRatio?: ImageSizePreset;
    numVariations?: number;
}

type ImageToImageRequest = TextToImageRequest & {
    images: string[];
}

type VideoRequest = BaseRequest & {
    duration: number;
    resolution?: '720p' | '1080p';
    size?: VideoSize;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    inputReference?: {image_url: string} | {image_url: string}[];
    numVariations?: number;
    idempotencyKey?: string;
}

type Cost = {
    cost: number;
    currency: string;
}

export type MediaResponse = {
    urls: string[];
    cost: Cost;
}

export type VideoSubmissionResponse = {
    id: string;
    costEstimate: Cost;
}

export type VideoGenerationResponse = {
    url: string;
    status: 'completed' | 'failed' | 'queued';
    cost: Cost;
}

export const imageSizeMap: Record<ImageSizePreset, string> = {
  auto: 'auto',
  square: '1024x1024',
  landscape: '1536x1024',
  portrait: '1024x1536',
  '2k-square': '2048x2048',
  '2k-landscape': '2048x1152',
  '4k-landscape': '3840x2160',
  '4k-portrait': '2160x3840',
}

export class MediaGenerator {
    private client: OpenAI | undefined;
    private readonly baseURL = 'https://api.lumenfall.ai/openai/v1';

    constructor(private readonly model: string) {
        this.model = model;
    }

    async textToImage(request: TextToImageRequest): Promise<MediaResponse> {
        const { model, prompt, aspectRatio='auto', numVariations=1 } = request;
        const client = this.getClient();
        const response = await client.images.generate({
            model: model,
            prompt: prompt,
            size: imageSizeMap[aspectRatio],
            n: numVariations,
        });
        const metadata = (response as unknown as {metadata: {cost: number, cost_currency: string}}).metadata;
        const data = response.data;

        if(!data || !metadata){
            throw new Error('Failed to generate image');
        }
        const urls = data.map((item) => item.url!);
        const cost = {
            cost: metadata.cost,
            currency: metadata.cost_currency,
        }
        return {
            urls,
            cost,
        }
    }

    async imageToImage(request: ImageToImageRequest): Promise<MediaResponse> {
        const { model, prompt, images, aspectRatio='auto', numVariations=1 } = request;
        const client = this.getClient();
        const files = await Promise.all(images.map(async (url) => {
            const file = await this.getFileFromUrl(url);
            if(!file){
                throw new Error(`Failed to get file from url: ${url}`);
            }
            return file;
        }));
        const response = await client.images.edit({
            model: model,
            prompt: prompt,
            size: imageSizeMap[aspectRatio],
            n: numVariations,
            image: files
        });
        const metadata = (response as unknown as {metadata: {cost: number, cost_currency: string}}).metadata;
        const data = response.data;

        if(!data || !metadata){
            throw new Error('Failed to generate image');
        }
        const urls = data.map((item) => item.url!);
        const cost = {
            cost: metadata.cost,
            currency: metadata.cost_currency,
        }
        return {
            urls,
            cost,
        }
    }

    async submitVideoGeneration(request: VideoRequest): Promise<VideoSubmissionResponse> {
        const { model, prompt, duration, inputReference, numVariations=1, idempotencyKey, resolution='1080p', aspectRatio='16:9' } = request;
        const submitRes = await fetch(`${this.baseURL}/videos`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.LUMEN_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              prompt,
              aspect_ratio: aspectRatio,
              seconds: duration,
              n: numVariations,
              idempotency_key: idempotencyKey,
              resolution,
              input_reference: inputReference,
            })
          });
        if(!submitRes.ok){
            throw new Error(`Failed to submit video generation: ${submitRes.statusText}`);
        }
        const data = await submitRes.json();
        return {
            id: data.id as string,
            costEstimate: {
                cost: data.metadata.cost_estimate,
                currency: data.metadata.cost_currency,
            },
        }
    }

    async pollVideoGeneration(videoId: string): Promise<VideoGenerationResponse> {
        const pollRes = await fetch(`${this.baseURL}/videos/${videoId}`, {
            headers: { 'Authorization': `Bearer ${process.env.LUMEN_API_KEY}` }
        });
        const result = await pollRes.json();
        if(!pollRes.ok){
            throw new Error(`Failed to poll video generation: ${pollRes.statusText}`);
        }
        if (result.status === 'completed') {
            return {
                url: result.output.url,
                status: 'completed',
                cost: {
                    cost: result.metadata.cost || 0,
                    currency: result.metadata.cost_currency || 'USD',
                }
            }
        } else if (result.status === 'failed') {
            return {
                url: '',
                status: 'failed',
                cost: {
                    cost: result.metadata.cost || result.metadata.cost_estimate || 0,
                    currency: result.metadata.cost_currency || result.metadata.cost_currency_estimate || 'USD',
                }
            }
        }
        return {
            url: '',
            status: 'queued',
            cost: {
                cost: result.metadata.cost_estimate || 0,
                currency: result.metadata.cost_currency_estimate || 'USD',
            }
        }
    }

    private getClient(): OpenAI {
        if (this.client) {
            return this.client;
        }
        this.client = new OpenAI({
            apiKey: process.env.LUMEN_API_KEY,
            baseURL: this.baseURL
        });
        return this.client;
    }

    private async getFileFromUrl(url: string): Promise<File | null> {
        try{
            const response = await fetch(url);
            if(!response.ok){
                return null;
            }
            const blob = await response.blob();
            return new File([blob], url.split('/').pop()!, { type: blob.type });
        }catch(error){
            return null;
        }
    }
}
