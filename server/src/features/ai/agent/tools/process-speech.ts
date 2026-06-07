import { z } from "zod";
import { buildBaseTool, ToolResult } from "./tool-definition";
import { failure, success } from "./utils";
import { aiAudioBillable } from "@/features/media-engine/generators/billable-ai-audio";
import {v4 as uuid4} from 'uuid'
import { billingService, withBilling } from "@/features/billing";
import { Session } from "../core/session";
import { TranscriptionWord } from "openai/resources/audio/transcriptions";
import { fileFormat } from "@/features/file-system/constants";
import { createAssetWithFileNode } from "@/features/media-engine/repo";
import { createFileWithContentAtPosition } from "@/features/file-system/repo";
import * as storage from '@/features/media-engine/storage';
import { parseBuffer } from 'music-metadata';
import { WordsWithText } from "@/features/media-engine/generators/ai-audio";

const DEFAULT_AUDIO_DURATION = 5 * 60; // 3 minutes

const textToSpeechInputSchema = z.object({
    cmd: z.literal('text-to-speech').describe('The command to use for text to speech conversion'),
    text: z.string().describe('The text to synthesize into audio'),
    instructions: z.string().optional().describe('Additional instructions to control the audio synthesis'),
    writeToFolderId: z.string().describe('The ID of the folder to write the audio stream to.'),
    fileName: z.string().optional().describe('The name of the audio file to write to if writeToFolderId is specified. If the name exists, the file will be overwritten.'),
});

const speechToTextInputSchema = z.object({
    cmd: z.literal('speech-to-text').describe('The command to use for speech to text conversion'),
    fileId: z.string().describe('The ID of the audio file to transcribe'),
    mode: z.enum(['transcript', 'caption']).describe('The mode to use for transcription'),
    writeToFolderId: z.string().optional().describe('The ID of the folder to write the transcription.'),
    fileName: z.string().optional().describe('The name of the audio file to write to if writeToFolderId is specified. If the name exists, the file will be overwritten.'),
});

export const processSpeechTool = buildBaseTool({
    name: 'processSpeech',
    description: 'Use this tool for text to speech and speech to text conversion.',
    inputSchema: z.object({
        command: z.discriminatedUnion('cmd', [textToSpeechInputSchema, speechToTextInputSchema]),
    }),
    execute: async ({ command }, {session}) => {
        switch(command.cmd){
            case 'text-to-speech':
                return await textToSpeech(command, session);
            case 'speech-to-text':
                return await speechToText(command, session);
            default:
                return failure('Invalid command. Supported commands are "text-to-speech" and "speech-to-text".');
        }
    },
})


async function textToSpeech(command: z.infer<typeof textToSpeechInputSchema>, session: Session): Promise<ToolResult> {
    const processAiAudio = withBilling(aiAudioBillable, billingService);
 
    try {
        const output = await processAiAudio({
            type: 'text-to-speech',
            params: {
                text: command.text,
                instructions: command.instructions,
            }
        }, {
            organizationId: session.organizationId,
            userId: session.userId,
            metadata: { runId: uuid4() },
        }
    )

    const result = output.result as ArrayBuffer;
    let fileName = storage.sanitizeFileName(command.fileName ?? 'audio.mp3');
    if(!fileName.endsWith('.mp3')){
        fileName += '.mp3';
    }
    const destPath = storage.buildStoragePath('audios', fileName);
    const buffer = Buffer.from(result);
    const uploaded = await storage.uploadFromBuffer(buffer, destPath, 'audio/mp3')
    const metadata = await parseBuffer(buffer);
    // Create asset from the blob
    const fileResponse = await createAssetWithFileNode({
        projectId: session.projectId,
        name: fileName,
        type: 'audio',
        url: uploaded.url,
        source: 'ai-generated',
        folderId: command.writeToFolderId,
        storageKey: uploaded.storageKey,
        metadata: {
            size: uploaded.size,
            contentType: 'audio/mp3',
            duration: metadata.format?.duration ?? 0,
        },
        filePosition: 0,
    })
    if(!fileResponse){
        return failure(`Failed to create file node.`);
    }
    const fileNode = fileResponse.fileNode;
    return success(`The audio file is saved in the file [ID ${fileNode.id}] [Format ${fileNode.format}].`);
    }catch(error){
        return failure(`Text to speech conversion failed.`);
    }
}

async function speechToText(command: z.infer<typeof speechToTextInputSchema>, session: Session): Promise<ToolResult> {
    const processAiAudio = withBilling(aiAudioBillable, billingService);
 
    try {
        // Get the file from the database
        const file = await session.resolveFileByPathOrId(command.fileId);
        if(!file){
            return failure(`File not found.`);
        }
        if(file.format !== fileFormat.AUDIO){
            return failure(`File is not an "${fileFormat.AUDIO}" format.`);
        }
        const content = await file.getFileContent();
        if(!content.ok || content.data === null){
            return failure(content.error || 'Failed to get the content of the file.');
        }
        if(content.data.type !== 'audio'){
            return failure(`The file content type ${content.data.type} is not supported for transcription.`);
        }
        const audioUrl = content.data.data.url;
        const audioDuration = content.data.data.metadata?.duration ?? DEFAULT_AUDIO_DURATION;
        const output = await processAiAudio({
            type: 'speech-to-text',
            params: {
                url: audioUrl,
                audioDurationSeconds: audioDuration,
                mode: command.mode,
            }
        }, {
            organizationId: session.organizationId,
                userId: session.userId,
                metadata: { runId: uuid4() },
            }
        )
        const result = output.result as string | WordsWithText;
        const isMarkdown = typeof result === 'string';

        if(command.writeToFolderId){
            if(!command.fileName){
                return failure(`File name is required when writing to writeToFolderId is specified.`);
            }
            const folder = await session.resolveFileByPathOrId(command.writeToFolderId);
            if(!folder){
                return failure(`File "${command.writeToFolderId}" not found.`);
            }
            if(!folder.isDirectory){
                return failure(`File "${command.writeToFolderId}" is not a directory.`);
            }
    
            const fileNode = await createFileWithContentAtPosition(
                session.projectId, 
                {
                    name: command.fileName,
                    directory: false,
                    parentId: folder.id,
                    format: isMarkdown ? fileFormat.MARKDOWN : fileFormat.JSON,
                    editable: isMarkdown,
                    projectId: session.projectId,
                    position: 0,
                }, 
                null, 
                'end',
                {
                    markdown: isMarkdown ? result : undefined,
                    json: isMarkdown ? undefined : result,
                }
            );
            if(!fileNode){
                return failure(`Failed to create file node.`);
            }
            return success(`Speech to text conversion completed successfully. File [ID ${fileNode.id}] [Format ${fileNode.format}] was successfully created.`);
            
        }
        const returnContent = isMarkdown ? result : JSON.stringify(result, null, 2);
        return success(returnContent);
        // Create asset from the result
        // Save the file and asset to the database
        // Return the file id 
    }catch(error){
        return failure(`Speech to text conversion failed.`);
    }
}