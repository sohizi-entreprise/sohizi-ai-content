import * as repo from './repo';
import * as storage from './storage';
import type { GetUploadUrlInput, uploadSuccessSchema } from './schema';
import { BadRequest, Forbidden, NotFound } from '../error';
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
import { BaseStreamData, decrementKey, incrementKey, markStreamActive, readStreamChunks, removeStreamActive, writeStreamData } from '../generation-request/stream-handler';
import { sse } from 'elysia';
import { ZipArchive } from 'archiver';
import { PassThrough, Readable } from 'node:stream';


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

export async function getDownloadUrl(projectId: string, assetId: string) {
    const asset = await repo.getAssetById(projectId, assetId);
    if (!asset) {
        throw new NotFound('Asset not found');
    }

    try {
        return await storage.generateSignedDownloadUrl(asset.storageKey, asset.name);
    } catch (error) {
        console.error(error);
        throw new BadRequest('Failed to generate signed download url');
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
    
    const fileExists = await storage.fileExists(storageKey);
    if (!fileExists) {
        throw new NotFound('File not found');
    }

    const fileMetadata = await storage.getFileMetadata(data.storageKey);
    if (fileMetadata.size > storage.getMaxUploadSizeInBytes(fileMetadata.contentType)) {
        await storage.deleteFile(storageKey);
        throw new BadRequest('Uploaded file exceeds the maximum allowed size');
    }

    const fileName = getFileName(storageKey);
    const siblingsFiles = await listDirectoryFiles(projectId, uploadfolderId);
    const isOverwrite = siblingsFiles.some((file) => file.name === fileName);
    if (siblingsFiles.length >= 100 && !isOverwrite) {
        throw new BadRequest('Maximum number of files reached in the folder');
    }

    // save the asset to the database
    try {
        const lastPosition = siblingsFiles[siblingsFiles.length - 1]?.position ?? 0;
        const filePosition = lastPosition + ORDER_GAP;
        const response = await repo.createAssetWithFileNode({
            projectId,
            name: fileName,
            type: getAssetType(fileMetadata.contentType),
            url: storage.buildPublicUrl(storageKey),
            source: 'user-uploaded',
            folderId: uploadfolderId,
            metadata: fileMetadata,
            storageKey,
            filePosition
        });
        return response;
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
    const run = await repo.createAssetRequest(payload.projectId, payload.userPrompt, payload.settings);
    await markStreamActive(run.id);
    await incrementKey(run.id);

    runAgent({...payload, runId: run.id});
    return run;
}

export const cancelGeneration = async (requestId: string) => {
    await broadcastCancellation(requestId);
    await repo.updateAssetRequest(requestId, { status: 'finished' });
    await removeStreamActive(requestId);
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
          systemPrompt: fullPrompt(agentDefinition.baseSystemPrompt, payload.settings ?? {}),
          session,
          model,
          modelConfig: agentDefinition.modelConfig,
          persistence: persistence,
          maxContextTokens: agentDefinition.maxContextTokens,
          contextThreshold: agentDefinition.contextThreshold,
          summaryModelId: agentDefinition.summaryModelId,
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
      const remaining = await decrementKey(runId);
      if (remaining === 0) {
        await removeStreamActive(runId);
      }
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

export const deleteAsset = async (assetId: string) => {
    return await repo.deleteAsset(assetId);
}

export const updateHtmlAssetValues = async (
    projectId: string,
    assetId: string,
    values: Record<string, string | number | boolean>,
) => {
    const asset = await repo.getAssetById(projectId, assetId);
    if (!asset) {
        throw new NotFound('Asset not found');
    }
    if (asset.type !== 'html') {
        throw new BadRequest('Only HTML assets support composition values');
    }

    const updated = await repo.updateAssetMetadataValues(projectId, assetId, values);
    if (!updated) {
        throw new NotFound('Asset not found');
    }

    return updated;
}

export const attachAssetToFileNode = async (projectId: string, assetId: string, folderId: string) => {
    const asset = await repo.getAssetById(projectId, assetId);
    if(!asset || asset.fileNodeId){
        throw new Forbidden('Asset does not exist or already attached to a file node');
    }
    const folder = await getFileNodeById(projectId, folderId);
    if(!folder || !folder.directory){
        throw new Forbidden('Folder does not exist or is not a directory');
    }
    
    return await repo.attachAssetToFileNode({projectId, assetId, folderId});
}

export const deleteAssets = async (projectId: string, assetIds: string[]) => {
    const normalizedAssetIds = normalizeAssetIds(assetIds);
    await getAssetsForBulkAction(projectId, normalizedAssetIds);
    const deletedCount = await repo.deleteAssets(projectId, normalizedAssetIds);

    return { ok: deletedCount === normalizedAssetIds.length, count: deletedCount };
}

export const attachAssetsToFileNodes = async (projectId: string, assetIds: string[], folderId: string) => {
    const normalizedAssetIds = normalizeAssetIds(assetIds);
    const selectedAssets = await getAssetsForBulkAction(projectId, normalizedAssetIds);
    const attachedAsset = selectedAssets.find((asset) => asset.fileNodeId);
    if(attachedAsset){
        throw new Forbidden('One or more assets are already attached to a file node');
    }

    const folder = await getFileNodeById(projectId, folderId);
    if(!folder || !folder.directory){
        throw new Forbidden('Folder does not exist or is not a directory');
    }

    return await repo.attachAssetsToFileNodes({projectId, assetIds: normalizedAssetIds, folderId});
}

export const downloadAssetsZip = async (projectId: string, assetIds: string[]) => {
    const normalizedAssetIds = normalizeAssetIds(assetIds);
    const selectedAssets = await getAssetsForBulkAction(projectId, normalizedAssetIds);
    const assetsById = new Map(selectedAssets.map((asset) => [asset.id, asset]));
    const orderedAssets = normalizedAssetIds.flatMap((assetId) => {
        const asset = assetsById.get(assetId);
        return asset ? [asset] : [];
    });

    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = new PassThrough();
    archive.on('error', (error: Error) => output.destroy(error));
    archive.pipe(output);

    void (async () => {
        try {
            const usedNames = new Map<string, number>();
            for (const asset of orderedAssets) {
                const buffer = await storage.readFileBuffer(asset.storageKey);
                archive.append(buffer, { name: buildZipEntryName(asset.name, usedNames) });
            }
            await archive.finalize();
        } catch (error) {
            output.destroy(error instanceof Error ? error : new Error('Failed to build zip file'));
        }
    })();

    return new Response(Readable.toWeb(output) as unknown as BodyInit, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="generated-assets.zip"`,
        },
    });
}

function getAssetType(contentType: string): AssetType {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    if (contentType === 'text/html' || contentType.startsWith('text/html')) return 'html';
    return 'document';
}

function getFileName(storageKey: string): string {
    const name = storageKey.split('/').pop() || 'new-asset-file';
    return name;
}

function normalizeAssetIds(assetIds: string[]) {
    return [...new Set(assetIds)];
}

async function getAssetsForBulkAction(projectId: string, assetIds: string[]) {
    if(assetIds.length === 0){
        throw new BadRequest('At least one asset is required');
    }

    const selectedAssets = await repo.getAssetsByIds(projectId, assetIds);
    if(selectedAssets.length !== assetIds.length){
        throw new NotFound('One or more assets were not found');
    }

    return selectedAssets;
}

function buildZipEntryName(fileName: string, usedNames: Map<string, number>) {
    const sanitizedName = storage.sanitizeFileName(fileName) || 'asset';
    const currentCount = usedNames.get(sanitizedName) ?? 0;
    usedNames.set(sanitizedName, currentCount + 1);

    if(currentCount === 0){
        return sanitizedName;
    }

    const extensionIndex = sanitizedName.lastIndexOf('.');
    if(extensionIndex <= 0){
        return `${sanitizedName}-${currentCount + 1}`;
    }

    return `${sanitizedName.slice(0, extensionIndex)}-${currentCount + 1}${sanitizedName.slice(extensionIndex)}`;
}

function fullPrompt(basePrompt: string, settings: Record<string, unknown>){
    return `
${basePrompt}

<media_generation_context>
The following JSON contains the active settings selected by the user.
${JSON.stringify(settings)}
</media_generation_context>
    `.trim();
}