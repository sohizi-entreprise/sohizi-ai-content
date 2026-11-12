const CDN_ORIGIN = "https://cdn.sohizi.com"

type CdnImageOptions = {
  /** Target render width in CSS pixels × device pixel ratio budget. */
  width: number
  quality?: number
  format?: "avif" | "webp" | "auto"
}

/**
 * Cloudflare Image Resizing URL for assets on cdn.sohizi.com.
 * Pass a path like `app/plan_1.png` (no leading slash required).
 */
export function cdnImage(path: string, options: CdnImageOptions): string {
  const quality = options.quality ?? 75
  const format = options.format ?? "avif"
  const normalized = path
    .replace(/^https?:\/\/cdn\.sohizi\.com\//, "")
    .replace(/^cdn-cgi\/image\/[^/]+\//, "")
    .replace(/^\//, "")

  return `${CDN_ORIGIN}/cdn-cgi/image/width=${options.width},quality=${quality},format=${format}/${normalized}`
}
