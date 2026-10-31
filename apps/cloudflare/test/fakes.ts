import type { WorkerEnv } from "../src/env"

/** Minimal in-memory stand-in for the pieces of R2 the Worker touches. */
export class FakeR2Bucket {
  readonly objects = new Map<string, Uint8Array>()

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
}

export type TestEnv = {
  bucket: FakeR2Bucket
  env: WorkerEnv
}

export function createTestEnv(
  overrides: Partial<Record<string, string>> = {},
): TestEnv {
  const bucket = new FakeR2Bucket()
  const env = {
    R2_BUCKET: bucket,
    MAX_MP3_BYTES: "20971520",
    R2_PUBLIC_URL: "https://media-dev.sohizi.com",
    ...overrides,
  } as unknown as WorkerEnv

  return { bucket, env }
}

async function toBytes(value: unknown): Promise<Uint8Array> {
  if (value instanceof Uint8Array) return value
  if (typeof value === "string") return new TextEncoder().encode(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (value instanceof ReadableStream) {
    return new Uint8Array(await new Response(value).arrayBuffer())
  }
  return new TextEncoder().encode(JSON.stringify(value))
}
