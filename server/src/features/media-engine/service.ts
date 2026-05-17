import { inngest } from '@/lib/inngest';
import * as repo from './repo';
import * as storage from './storage';
import type { GenerateImageInput, GenerateAudioInput, GenerateVideoInput, GetUploadUrlInput, uploadSuccessSchema } from './schema';
import { BadRequest, NotFound } from '../error';
import { getProjectById } from '../project/repo';
import z from 'zod';
import { getFileNodeById, listDirectoryFiles, ORDER_GAP } from '../file-system/repo';
import { AssetType } from '@/type';

export async function generateImage(data: GenerateImageInput) {
    const genRequest = await repo.createGenerationRequest({
        projectId: data.projectId,
        type: 'image',
        request: {
            prompt: data.prompt,
            model: data.model,
            aspectRatio: data.aspectRatio,
            referenceImages: data.referenceImages,
            numVariations: data.numVariations,
        },
    });

    await inngest.send({
        name: 'media/generate.image',
        data: {
            requestId: genRequest.id,
            projectId: data.projectId,
            prompt: data.prompt,
            model: data.model,
            aspectRatio: data.aspectRatio,
            referenceImages: data.referenceImages,
            numVariations: data.numVariations,
        },
    });

    return { requestId: genRequest.id };
}

export async function generateAudio(data: GenerateAudioInput) {
    const genRequest = await repo.createGenerationRequest({
        projectId: data.projectId,
        type: 'audio',
        request: {
            prompt: data.prompt,
            audioType: data.audioType,
        },
    });

    await inngest.send({
        name: 'media/generate.audio',
        data: {
            requestId: genRequest.id,
            projectId: data.projectId,
            prompt: data.prompt,
            audioType: data.audioType,
        },
    });

    return { requestId: genRequest.id };
}

export async function generateVideo(data: GenerateVideoInput) {
    const genRequest = await repo.createGenerationRequest({
        projectId: data.projectId,
        type: 'video',
        request: {
            prompt: data.prompt,
            model: data.model,
            duration: data.duration,
            aspectRatio: data.aspectRatio,
            referenceImage: data.referenceImage,
        },
    });

    await inngest.send({
        name: 'media/generate.video',
        data: {
            requestId: genRequest.id,
            projectId: data.projectId,
            prompt: data.prompt,
            model: data.model,
            duration: data.duration,
            aspectRatio: data.aspectRatio,
            referenceImage: data.referenceImage,
        },
    });

    return { requestId: genRequest.id };
}

export async function getUploadUrl(data: GetUploadUrlInput) {

    const project = await getProjectById(data.projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }

    try {
        const { url, storageKey, maxSizeInBytes } = await storage.generateSignedUploadUrl(
            data.fileName,
            data.contentType,
        );

        // Check if the file already exists
        const fileExists = await storage.fileExists(storageKey);
        if (fileExists) {
            throw new BadRequest('File already exists');
        }
    
        return { url, storageKey, maxSizeInBytes };
    } catch (error) {
        console.error(error);
        throw new BadRequest('Failed to generate signed upload url');
    }
}

export async function uploadSuccess(data: z.infer<typeof uploadSuccessSchema>) {
    const { projectId, folderId, storageKey } = data;
    const project = await getProjectById(projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }
    const folder = await getFileNodeById(projectId, folderId);
    if (!folder) {
        throw new NotFound('Folder not found');
    }
    if(!folder.directory){
        throw new BadRequest('Required a folder to upload the file to');
    }
    // Check the total number of files in the folder does not exceed 100
    const siblingsFiles = await listDirectoryFiles(projectId, folderId);
    const totalFiles = siblingsFiles.length;
    if (totalFiles >= 100) {
        throw new BadRequest('Maximum number of files reached in the folder');
    }
    const fileExists = await storage.fileExists(storageKey);
    if (!fileExists) {
        throw new NotFound('File not found');
    }

    const fileMetadata = await storage.getFileMetadata(data.storageKey);
    if (fileMetadata.size > storage.getMaxUploadSizeInBytes(fileMetadata.contentType)) {
        await storage.deleteFile(storageKey);
        throw new BadRequest('Uploaded file exceeds the maximum allowed size');
    }

    // save the asset to the database
    try {
        const lastPosition = siblingsFiles[siblingsFiles.length - 1]?.position ?? 0;
        const filePosition = lastPosition + ORDER_GAP;
        const response = await repo.createAssetWithFileNode({
            projectId,
            name: getFileName(storageKey),
            type: getAssetType(fileMetadata.contentType),
            url: storage.buildPublicUrl(storageKey),
            source: 'user-uploaded',
            folderId,
            metadata: fileMetadata,
            storageKey,
            filePosition
        });
        return response.fileNode;
    } catch (error) {
        console.error(error);
        throw new BadRequest('Failed to create asset with file node');
    }
}

export async function getPendingRequests(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }
    return repo.getPendingRequests(projectId);
}

function getAssetType(contentType: string): AssetType {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    return 'document';
}

function getFileName(storageKey: string): string {
    const name = storageKey.split('/').pop() || 'new-asset-file';
    return name;
}