import { v4 as uuidv4 } from 'uuid';
import { S3Client } from 'bun';
import { createHash, createHmac } from 'node:crypto';
import { parseBuffer } from 'music-metadata';

const S3_SIGNED_URL_EXPIRY_SECONDS = 10 * 60;
const S3_SIGNING_SERVICE = 's3';
const S3_SIGNING_TERMINATOR = 'aws4_request';
const S3_SIGNING_ALGORITHM = 'AWS4-HMAC-SHA256';

let s3Client: S3Client | undefined;

type S3Config = {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    region: string;
};

type SignedUrlMethod = 'GET' | 'PUT';

function getS3Config(): S3Config {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!endpoint) throw new Error('R2_ENDPOINT environment variable is required');
    if (!accessKeyId) throw new Error('R2_ACCESS_KEY_ID environment variable is required');
    if (!secretAccessKey) throw new Error('R2_SECRET_ACCESS_KEY environment variable is required');
    if (!bucket) throw new Error('R2_BUCKET_NAME environment variable is required');

    return {
        endpoint,
        accessKeyId,
        secretAccessKey,
        bucket,
        region: 'auto',
    };
}

function getS3Client(): S3Client {
    if (s3Client) return s3Client;
    const config = getS3Config();
    s3Client = new S3Client({
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        bucket: config.bucket,
    });
    return s3Client;
}

function getAssetFolder(contentType: string) {
    if (contentType.startsWith('image/')) return 'images';
    if (contentType.startsWith('video/')) return 'videos';
    if (contentType.startsWith('audio/')) return 'audios';
    if (contentType === 'text/html' || contentType.startsWith('text/html')) return 'htmls';
    return 'documents';
}

export function getMaxUploadSizeInBytes(contentType: string): number {
    if (contentType.startsWith('video/')) return 15 * 1024 * 1024;
    if (contentType.startsWith('audio/')) return 15 * 1024 * 1024;
    return 5 * 1024 * 1024;
}

export function sanitizeFileName(fileName: string): string {
    return fileName.replace(/[/\\\s]+/g, '-').toLowerCase().trim();
}

function formatAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getDateStamp(date: Date): string {
    return formatAmzDate(date).slice(0, 8);
}

function hmac(key: string | Buffer, value: string): Buffer {
    return createHmac('sha256', key).update(value).digest();
}

function getSigningKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
    const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, S3_SIGNING_SERVICE);
    return hmac(serviceKey, S3_SIGNING_TERMINATOR);
}

export function buildPublicUrl(storageKey: string): string {
    const baseUrl = process.env.R2_PUBLIC_URL;
    if (!baseUrl) throw new Error('R2_PUBLIC_URL environment variable is required');

    return `${baseUrl.replace(/\/$/, '')}/${storageKey}`;
}

function createSignedObjectUrl(
    config: S3Config,
    storageKey: string,
    method: SignedUrlMethod,
    queryParams: Record<string, string> = {},
): string {
    const now = new Date();
    const dateStamp = getDateStamp(now);
    const amzDate = formatAmzDate(now);
    const { url, canonicalUri } = buildObjectUploadUrl(config.endpoint, config.bucket, storageKey);
    const credential = [
        config.accessKeyId,
        dateStamp,
        config.region,
        S3_SIGNING_SERVICE,
        S3_SIGNING_TERMINATOR,
    ].join('/');
    const signedHeaders = 'host';

    const signingQueryParams: Record<string, string> = {
        ...queryParams,
        'X-Amz-Algorithm': S3_SIGNING_ALGORITHM,
        'X-Amz-Credential': credential,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(S3_SIGNED_URL_EXPIRY_SECONDS),
        'X-Amz-SignedHeaders': signedHeaders,
    };

    const canonicalQueryString = buildCanonicalQueryString(signingQueryParams);
    const canonicalHeaders = `host:${url.host}\n`;
    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        'UNSIGNED-PAYLOAD',
    ].join('\n');
    const credentialScope = [
        dateStamp,
        config.region,
        S3_SIGNING_SERVICE,
        S3_SIGNING_TERMINATOR,
    ].join('/');
    const stringToSign = [
        S3_SIGNING_ALGORITHM,
        amzDate,
        credentialScope,
        createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signingKey = getSigningKey(config.secretAccessKey, dateStamp, config.region);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    url.search = `${canonicalQueryString}&X-Amz-Signature=${awsEncodeURIComponent(signature)}`;
    return url.toString();
}

function createSignedPutUrl(config: S3Config, storageKey: string): string {
    return createSignedObjectUrl(config, storageKey, 'PUT');
}

function createSignedGetUrl(config: S3Config, storageKey: string, fileName: string): string {
    return createSignedObjectUrl(config, storageKey, 'GET', {
        'response-content-disposition': buildAttachmentDisposition(fileName),
    });
}

function buildObjectUploadUrl(
    endpoint: string,
    bucket: string,
    storageKey: string,
): { url: URL; canonicalUri: string } {
    const url = new URL(endpoint.replace(/\/$/, ''));
    const basePath = normalizePath(url.pathname);
    const encodedStorageKey = encodePathSegments(storageKey);
    const canonicalUri = url.hostname.split('.')[0] === bucket
        ? joinPath(basePath, encodedStorageKey)
        : joinPath(basePath, awsEncodeURIComponent(bucket), encodedStorageKey);

    url.pathname = canonicalUri;
    return { url, canonicalUri };
}

function buildCanonicalQueryString(params: Record<string, string>): string {
    return Object.entries(params)
        .map(([key, value]) => [awsEncodeURIComponent(key), awsEncodeURIComponent(value)] as const)
        .sort(([aKey, aValue], [bKey, bValue]) => {
            if (aKey !== bKey) return aKey < bKey ? -1 : 1;
            if (aValue !== bValue) return aValue < bValue ? -1 : 1;
            return 0;
        })
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
}

function encodePathSegments(path: string): string {
    return path.split('/').map(awsEncodeURIComponent).join('/');
}

function normalizePath(path: string): string {
    const normalized = path.replace(/\/+$/, '');
    return normalized === '' ? '/' : normalized;
}

function joinPath(...parts: string[]): string {
    const path = parts
        .filter(Boolean)
        .join('/')
        .replace(/\/+/g, '/');

    return path.startsWith('/') ? path : `/${path}`;
}

function awsEncodeURIComponent(value: string): string {
    return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
        `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

function buildAttachmentDisposition(fileName: string): string {
    const fallbackFileName = sanitizeFileName(fileName)
        .replace(/[^\x20-\x7E]|["\r\n;]/g, '')
        || 'download';

    return `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${awsEncodeURIComponent(fileName)}`;
}

export async function generateSignedUploadUrl(
    fileName: string,
    contentType: string,
): Promise<{ url: string; storageKey: string; maxSizeInBytes: number }> {
    const assetFolder = getAssetFolder(contentType);
    const storageKey = buildStoragePath(assetFolder, fileName);
    const maxSizeInBytes = getMaxUploadSizeInBytes(contentType);
    const config = getS3Config();

    return {
        url: createSignedPutUrl(config, storageKey),
        storageKey,
        maxSizeInBytes,
    };
}

export async function generateSignedDownloadUrl(
    storageKey: string,
    fileName: string,
): Promise<{ url: string }> {
    const config = getS3Config();

    return {
        url: createSignedGetUrl(config, storageKey, fileName),
    };
}

export async function uploadFromUrl(
    sourceUrl: string,
    destinationPath: string,
): Promise<{ url: string; storageKey: string; size: number }> {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
        throw new Error(`Failed to download from ${sourceUrl}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const contentType = blob.type || 'application/octet-stream';

    return uploadFromBuffer(buffer, destinationPath, contentType);
}

export async function uploadFromBuffer(
    buffer: Buffer,
    destinationPath: string,
    contentType: string,
): Promise<{ url: string; storageKey: string; size: number }> {
    await getS3Client().write(destinationPath, buffer, {
        type: contentType,
    });

    return {
        url: buildPublicUrl(destinationPath),
        storageKey: destinationPath,
        size: buffer.length,
    };
}

export function buildStoragePath(
    assetType: 'images' | 'videos' | 'audios' | 'documents' | 'htmls',
    filename: string,
): string {
    const key = uuidv4()
    return `${assetType}/${key}/${sanitizeFileName(filename)}`;
}

export async function fileExists(storageKey: string): Promise<boolean> {
    const client = getS3Client();
    return await client.exists(storageKey);
}

export type FileMetadataResult = {
    contentType: string;
    size: number;
    duration?: number;
};

export async function getFileMetadata(storageKey: string): Promise<FileMetadataResult> {
    const client = getS3Client();
    const stat = await client.stat(storageKey);
    const contentType = stat.type;

    let duration: number | undefined;

    if (contentType.startsWith('audio/')) {
        const buffer = Buffer.from(await client.file(storageKey).arrayBuffer());
        try {
            const metadata = await parseBuffer(buffer, { mimeType: contentType });
            duration = metadata.format.duration;
        } catch {
            // duration stays undefined if parsing fails
        }
    }

    return {
        contentType,
        size: stat.size,
        duration,
    };
}

export async function readFileBuffer(storageKey: string): Promise<Buffer> {
    const arrayBuffer = await getS3Client().file(storageKey).arrayBuffer();
    return Buffer.from(arrayBuffer);
}

export async function deleteFile(storageKey: string): Promise<void> {
    await getS3Client().delete(storageKey);
}

