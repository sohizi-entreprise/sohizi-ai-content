import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { mediaConstants } from '@/constants'
import * as mediaEngineService from '@/features/media-engine/service';

const imageModels = z.enum(mediaEngineService.models.image);

export const generateImageSchema = z.object({
    prompt: z.string().min(1).describe('The prompt to generate the image'),
    model: imageModels.describe('The model to use for the image generation. If not precised by the user, use Flux or gemini-3.1-flash-image-preview [Nano banana] as they are faster and cheaper.'),
    aspectRatio: z.enum(mediaConstants.imageSizePresets).default('auto').describe('The aspect ratio of the image'),
    referenceImages: z.array(z.url()).max(5).optional().describe('Optional reference images to use for the image generation. Maximum 5 reference images.'),
    numVariations: z.number().int().min(1).max(4).default(1).describe('The number of variations to generate. Maximum 4 variations.'),
})

export const generateImageTool = buildBaseTool({
    name: 'generateImage',
    description: 'Generates one or more images based on the prompt and reference images',
    inputSchema: generateImageSchema,
    execute: async (input, {session}) => {
        const { prompt, model, aspectRatio, referenceImages, numVariations } = input;
        const projectId = session.projectId;
        try{
            const {requestId} = await mediaEngineService.generateImage({
                projectId,
                prompt,
                model,
                aspectRatio,
                referenceImages,
                numVariations,
            });
            const msg = `Image submitted successfully. Here is the request ID: ${requestId}. This can take up to 2 min to complete. User will be notified when the image is ready.`;
            return { success: true, output: msg };
        }catch(error){
            const errorMsg = error instanceof Error ? error.message : String(error);
            return { success: false, output: `Failed to generate image: ${errorMsg}` };
        }
    },
})