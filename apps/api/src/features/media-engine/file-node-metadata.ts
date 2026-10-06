import type { AssetMetadata } from "@/type"

/** Keep the asset row authoritative while copying its fields onto its file node. */
export function mergeAssetFileNodeMetadata(
  fileNodeMetadata: Record<string, unknown> | null | undefined,
  asset: {
    metadata: AssetMetadata | null
    url: string
    storageKey: string
  },
): Record<string, unknown> {
  return {
    ...(fileNodeMetadata ?? {}),
    ...(asset.metadata ?? {}),
    url: asset.url,
    storageKey: asset.storageKey,
  }
}
