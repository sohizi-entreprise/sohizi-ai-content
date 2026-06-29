import * as repo from './repo';
import * as storage from './storage';
import type { GetUploadUrlInput, uploadSuccessSchema } from './schema';
import { BadRequest, NotFound } from '../error';
import { getProjectById } from '../project/repo';
import z from 'zod';
import { getFileNodeById, listDirectoryFiles, ORDER_GAP } from '../file-system/repo';
import { AssetType, CursorPaginationOptions } from '@/type';
import { userModelMessageSchema } from 'ai';
import { broadcastCancellation, createCancellableController } from '../generation-request/abort-manager';
import { Session } from '../ai/agent/core/session';
import { v4 as uuidv4 } from 'uuid';
import { MediaGenerationPersistence } from '../ai/agent/core/persistence';
import { getAgentDefinition } from '../ai/agent/core/agent-registry';
import { Agent } from '../ai/agent/core/agent';
import { getModelById } from '../chat/repo';
import { BaseStreamData, decrementKey, incrementKey, readStreamChunks, writeStreamData } from '../generation-request/stream-handler';
import { sse } from 'elysia';


export async function getUploadUrl(projectId: string, data: GetUploadUrlInput) {

    const project = await getProjectById(projectId);
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

export async function uploadSuccess(projectId: string, data: z.infer<typeof uploadSuccessSchema>) {
    const { folderId, storageKey } = data;
    let uploadfolderId = folderId;
    const project = await getProjectById(projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }
    if(!folderId){
        const { uploadsFolder } = await repo.getAssetFolder(projectId);
        uploadfolderId = uploadsFolder?.id ?? null;
    }else{
        const folder = await getFileNodeById(projectId, folderId);
        if(!folder || !folder.directory){
            throw new BadRequest('Required a folder to upload the file to');
        }
        uploadfolderId = folder.id;
    }

    if (!uploadfolderId) {
        throw new NotFound('Folder not found');
    }
    
    // Check the total number of files in the folder does not exceed 100
    const siblingsFiles = await listDirectoryFiles(projectId, uploadfolderId);
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
            folderId: uploadfolderId,
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

export const assetRequestSchema = z.object({
    userPrompt: userModelMessageSchema,
    settings: z.record(z.string(), z.any()).optional(),
})

export type RunAgentPayload = {
    userId: string;
    projectId: string;
} & z.infer<typeof assetRequestSchema>;

export const generateAsset = async (payload: RunAgentPayload) => {
    const run = await repo.createAssetRequest(payload.projectId, payload.settings);
    await incrementKey(run.id);

    runAgent({...payload, runId: run.id});
    return run;
}

export const cancelGeneration = async (requestId: string) => {
    await broadcastCancellation(requestId);
    await repo.updateAssetRequest(requestId, { status: 'finished' });
    // Cancel any running inngest job
    return {ok: true, error: null};
}

async function runAgent(payload: RunAgentPayload & { runId: string }){
    const { userId, projectId, runId, userPrompt } = payload;
    const { controller, cleanup } = await createCancellableController(runId);
    
    try {
      await repo.updateAssetRequest(runId, { status: 'running' })

      const project = await getProjectById(projectId);
      
      const session = new Session({
          sessionId: uuidv4(),
          userId,
          organizationId: project.organizationId,
          projectId: project.id,
          runId,
      })
      const persistence = new MediaGenerationPersistence(runId);
  
      const agentDefinition = getAgentDefinition('media-generator');
      if(!agentDefinition){
        throw new Error('Agent definition not found');
      }
      const model = await getModelById(agentDefinition.modelId);
      if(!model){
        throw new Error('Model not found');
      }
      const agent = new Agent({
          name: agentDefinition.name,
          systemPrompt: agentDefinition.baseSystemPrompt,
          session,
          model,
          modelConfig: agentDefinition.modelConfig,
          persistence: persistence,
      })
  
      const chunks = agent.runLoop(
          userPrompt,
          controller.signal,
          250,
      )
  
      for await (const chunk of chunks) {
        await writeStreamData(runId, {runId, event:'chunk', chunk});
      }
  
      await repo.updateAssetRequest(runId, { status: 'finished' });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Completion failed';
      console.error(error);
      await repo.updateAssetRequest(runId, { status: 'error', error: errorMessage });
    } finally {
      await decrementKey(runId);
      await cleanup();
    }
  }



export const listAssets = async(projectId: string, options?: CursorPaginationOptions) => {
    return await repo.listAssetRequestAssets(projectId, options);
}

export const listAiGeneratedAssets = async(projectId: string, options?: CursorPaginationOptions & { type?: AssetType }) => {
    return await repo.listAiGeneratedAssets(projectId, options);
}

export async function* getRequestStreams(requestId: string) {
    for await (const chunk of readStreamChunks(requestId)) {
        const data = chunk.data as BaseStreamData;
        yield sse({
          id: chunk.id,
          event: data.event || 'chunk',
          data: chunk.data,
      });
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

function getAssetFolder(projectId: string){
    return
}