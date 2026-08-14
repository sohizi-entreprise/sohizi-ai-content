import type { WorkerEnv } from '../src/env'

/** Minimal in-memory stand-in for the pieces of R2 the Worker touches. */
export class FakeR2Bucket {
  readonly objects = new Map<string, Uint8Array>()
  readonly multipartUploads: Array<{ key: string; parts: number; aborted: boolean }> =
    []

  async get(key: string) {
    const bytes = this.objects.get(key)
    if (!bytes) return null
    return {
      size: bytes.byteLength,
      body: new Response(bytes).body,
      arrayBuffer: async () => bytes.slice().buffer,
      text: async () => new TextDecoder().decode(bytes),
      json: async () => JSON.parse(new TextDecoder().decode(bytes)),
    }
  }

  async put(key: string, value: unknown) {
    const bytes = await toBytes(value)
    this.objects.set(key, bytes)
    return { key, size: bytes.byteLength }
  }

  async delete(keys: string | Array<string>) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.objects.delete(key)
    }
  }

  async createMultipartUpload(key: string) {
    const record = { key, parts: 0, aborted: false }
    this.multipartUploads.push(record)
    const chunks: Array<Uint8Array> = []
    return {
      key,
      uploadId: 'fake-upload',
      uploadPart: async (partNumber: number, value: unknown) => {
        chunks[partNumber - 1] = await toBytes(value)
        record.parts = chunks.filter(Boolean).length
        return { partNumber, etag: `etag-${partNumber}` }
      },
      abort: async () => {
        record.aborted = true
      },
      complete: async () => {
        const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
        const joined = new Uint8Array(total)
        let offset = 0
        for (const chunk of chunks) {
          joined.set(chunk, offset)
          offset += chunk.byteLength
        }
        this.objects.set(key, joined)
        return { key, size: total }
      },
    }
  }
}

async function toBytes(value: unknown): Promise<Uint8Array> {
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (value && typeof (value as ReadableStream).getReader === 'function') {
    return new Uint8Array(
      await new Response(value as ReadableStream).arrayBuffer(),
    )
  }
  throw new Error('Unsupported value in FakeR2Bucket')
}

export type FakeInstanceStatus = {
  status: string
  output?: unknown
  error?: { name: string; message: string }
}

/** Stand-in for the Workflow binding, tracking created instances. */
export class FakeWorkflow {
  readonly instances = new Map<string, FakeInstanceStatus>()
  readonly createdParams = new Map<string, unknown>()
  readonly terminated: Array<string> = []
  createError: Error | null = null

  async create({ id, params }: { id?: string; params?: unknown }) {
    if (this.createError) throw this.createError
    const instanceId = id ?? crypto.randomUUID()
    if (this.instances.has(instanceId)) {
      throw new Error(`instance ${instanceId} already exists`)
    }
    this.instances.set(instanceId, { status: 'queued' })
    this.createdParams.set(instanceId, params)
    return this.instanceStub(instanceId)
  }

  async get(id: string) {
    if (!this.instances.has(id)) {
      throw new Error(`instance ${id} not found`)
    }
    return this.instanceStub(id)
  }

  setStatus(id: string, status: FakeInstanceStatus) {
    this.instances.set(id, status)
  }

  private instanceStub(id: string) {
    return {
      id,
      status: async () => this.instances.get(id) as FakeInstanceStatus,
      terminate: async () => {
        this.terminated.push(id)
        this.instances.set(id, { status: 'terminated' })
      },
      pause: async () => undefined,
      resume: async () => undefined,
      restart: async () => undefined,
    }
  }
}

export type TestEnv = {
  bucket: FakeR2Bucket
  workflow: FakeWorkflow
  env: WorkerEnv
}

export function createTestEnv(overrides: Partial<Record<string, string>> = {}): TestEnv {
  const bucket = new FakeR2Bucket()
  const workflow = new FakeWorkflow()
  const env = {
    R2_BUCKET: bucket,
    RENDER_WORKFLOW: workflow,
    RENDER_CONTAINER: {},
    RENDER_SERVICE_TOKEN: 'test-token',
    RENDER_ALLOWED_MEDIA_HOSTS: 'cdn.sohizi.com',
    RENDER_CONCURRENCY: '2',
    RENDER_POLL_INTERVAL_SECONDS: '5',
    RENDER_TIMEOUT_MINUTES: '30',
    MAX_MP3_BYTES: '20971520',
    ...overrides,
  } as unknown as WorkerEnv

  return { bucket, workflow, env }
}
