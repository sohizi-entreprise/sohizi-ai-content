import * as repo from './repo';
import * as storage from './storage';
import type { GetUploadUrlInput, uploadSuccessSchema } from './schema';
import { BadRequest, NotFound } from '../error';
import { getProjectById } from '../project/repo';
import z from 'zod';
import { getFileNodeById, listDirectoryFiles, ORDER_GAP } from '../file-system/repo';
import { AssetType } from '@/type';

export const models = {
    image: [
        'flux.2-max',
        'gpt-image-2',
        'gpt-image-1.5',
        'gemini-3.1-flash-image-preview',
        'gemini-3-pro-image-preview',
        'seedream-4.5',
        'seedream-5-lite'
    ],
    video: [
        'wan-2.6',
        'kling-v3',
        'seedance-2.0'
    ],
    videoToVideo: [
        'seedance-2.0'
    ],
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