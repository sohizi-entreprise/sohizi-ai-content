/** R2 requires 5 MiB minimum parts for every part except the last one. */
const MULTIPART_CHUNK_BYTES = 8 * 1024 * 1024

export type UploadResult = { sizeInBytes: number }

/**
 * Move a render from the container into R2 without ever holding the whole video
 * in memory.
 *
 * Always multipart, even when the container declares a `Content-Length`:
 * `R2Bucket.put` accepts a stream only when the runtime can prove its length up
 * front, and the response body of a subrequest does not qualify. Buffering one
 * part at a time sidesteps that and keeps the byte count exact.
 */
export async function uploadStreamToR2(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array>,
  options: { contentType: string; cacheControl?: string },
): Promise<UploadResult> {
  const httpMetadata: R2HTTPMetadata = {
    contentType: options.contentType,
    ...(options.cacheControl ? { cacheControl: options.cacheControl } : {}),
  }

  const upload = await bucket.createMultipartUpload(key, { httpMetadata })
  const parts: Array<R2UploadedPart> = []
  let pending: Array<Uint8Array> = []
  let pendingBytes = 0
  let totalBytes = 0

  const flush = async (force: boolean) => {
    if (pendingBytes === 0) return
    if (!force && pendingBytes < MULTIPART_CHUNK_BYTES) return

    const chunk = new Uint8Array(pendingBytes)
    let offset = 0
    for (const piece of pending) {
      chunk.set(piece, offset)
      offset += piece.byteLength
    }
    pending = []
    pendingBytes = 0

    parts.push(await upload.uploadPart(parts.length + 1, chunk))
  }

  const reader = body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      pending.push(value)
      pendingBytes += value.byteLength
      totalBytes += value.byteLength
      await flush(false)
    }
    await flush(true)
    if (parts.length === 0) {
      throw new Error('Container returned an empty render')
    }
    await upload.complete(parts)
    return { sizeInBytes: totalBytes }
  } catch (error) {
    await upload.abort().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
}
